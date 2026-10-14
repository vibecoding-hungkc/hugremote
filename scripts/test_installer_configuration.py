"""Installer configuration tests using real Bash and controlling PTYs.
Build/package installation and systemctl are not run on the host.
"""
import errno
import os
from pathlib import Path
import pty
import select
import signal
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ("beta.sh", "install.sh")


def interact(script, answers, piped=True, env=None):
    pid, fd = pty.fork()
    if pid == 0:
        try:
            if piped:
                result = subprocess.run(["bash"], input=script.encode(), env=env)
            else:
                result = subprocess.run(["bash", "-c", script], env=env)
            os._exit(result.returncode)
        except Exception:
            os._exit(99)
    output = b""
    cursor = 0
    index = 0
    deadline = time.monotonic() + 8
    try:
        while time.monotonic() < deadline:
            if select.select([fd], [], [], 0.1)[0]:
                try:
                    chunk = os.read(fd, 65536)
                except OSError as exc:
                    if exc.errno == errno.EIO:
                        break
                    raise
                if not chunk:
                    break
                output += chunk
                if index < len(answers):
                    token, answer = answers[index]
                    found = output.find(token.encode(), cursor)
                    if found >= 0:
                        cursor = found + len(token.encode())
                        os.write(fd, (answer + "\n").encode())
                        index += 1
        else:
            raise AssertionError("Prompt timeout: " + output.decode(errors="replace"))
        _, status = os.waitpid(pid, 0)
        pid = 0
        if index != len(answers):
            raise AssertionError("Missing prompts: " + output.decode(errors="replace"))
        return os.waitstatus_to_exitcode(status), output.decode(errors="replace")
    finally:
        os.close(fd)
        if pid:
            os.kill(pid, signal.SIGKILL)
            os.waitpid(pid, 0)


class ConfigurationTests(unittest.TestCase):
    def test_prompt_visible_with_pipe_and_terminal_stdin(self):
        for name in SCRIPTS:
            text = (ROOT / name).read_text()
            helper = text[text.index("prompt_user_input() {"):text.index('CONFIG_DIR="$HOME/.config/hugremote"')]
            for piped in (True, False):
                with self.subTest(script=name, piped=piped):
                    code, output = interact("set -e\n" + helper + '\nprompt_user_input "VISIBLE_QUESTION: " "default" ANSWER\nprintf "RESULT=%s\\n" "$ANSWER"\n', [("VISIBLE_QUESTION: ", "/remote")], piped)
                    self.assertEqual(code, 0, output)
                    self.assertIn("RESULT=/remote", output)

    def run_config(self, name, existing, answers, piped=True):
        with tempfile.TemporaryDirectory() as home:
            config = Path(home) / '.config/hugremote/.env'
            config.parent.mkdir(parents=True)
            if existing is not None:
                config.write_text(existing)
            text = (ROOT / name).read_text().split('# 6. Thiết lập Cấu hình tương tác (Interactive Configuration)\n')[1]
            script = '''set -e
PLATFORM=linux
INSTALL_DIR="$HOME/app"
TARGET_BIN_DIR="$HOME/.local/bin"
node() { printf 'test-session-secret\\n'; }
systemctl() { printf 'SYSTEMCTL:%s\\n' "$*"; }
''' + text
            code, output = interact(script, answers, piped, dict(os.environ, HOME=home))
            self.assertEqual(code, 0, output)
            service = Path(home) / '.config/systemd/user/hugremote.service'
            return config.read_text(), service.read_text(), output

    def test_fresh_config_documents_editable_base_path(self):
        for name in SCRIPTS:
            for piped in (True, False):
                with self.subTest(script=name, piped=piped):
                    config, service, output = self.run_config(name, None, [
                        ('Chọn Host', ''), ('Chọn chế độ Auth', ''),
                        ('Nhập cổng', '8123'), ('chạy ngầm ngay bây giờ?', 'n'),
                    ], piped)
                    self.assertIn('# Public subpath only, not a full URL.', config)
                    self.assertIn('BASE_PATH=\n', config)
                    self.assertIn('GOOGLE_CLIENT_ID=\n', config)
                    self.assertIn('WORKSPACE_ROOT=\n', config)
                    self.assertNotIn('EnvironmentFile=', service)
                    self.assertNotIn('Environment=BASE_PATH=', service)
                    self.assertNotIn('Environment=PORT=', service)
                    self.assertIn('http://localhost:8123/', output)

    def test_quick_update_preserves_config_byte_for_byte(self):
        existing = '''# user configuration\n PORT = 8099 # whitespace format accepted by CLI\nAUTH_MODE=password\nBASE_PATH=/old\nALLOWED_ROOT=/srv/project\nCUSTOM_FUTURE_SETTING=keep-me\n'''
        for name in SCRIPTS:
            with self.subTest(script=name):
                config, service, output = self.run_config(name, existing, [
                    ('Giữ nguyên cấu hình', ''), ('chạy ngầm ngay bây giờ?', 'n'),
                ])
                self.assertEqual(config, existing)
                self.assertIn('ALLOWED_ROOT=/srv/project', config)
                self.assertIn('CUSTOM_FUTURE_SETTING=keep-me', config)
                self.assertNotIn('EnvironmentFile=', service)
                self.assertIn('/old', output)

    def test_defaults_without_controlling_terminal(self):
        for name in SCRIPTS:
            text = (ROOT / name).read_text()
            helper = text[text.index('prompt_user_input() {'):text.index('CONFIG_DIR="$HOME/.config/hugremote"')]
            result = subprocess.run(['bash'], input=helper + '\nprompt_user_input "QUESTION" "default" ANSWER\nprintf "RESULT=%s" "$ANSWER"\n',
                                    text=True, capture_output=True, start_new_session=True, timeout=3)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('RESULT=default', result.stdout)

    def test_prompt_preserves_literal_input(self):
        for name in SCRIPTS:
            text = (ROOT / name).read_text()
            helper = text[text.index('prompt_user_input() {'):text.index('CONFIG_DIR="$HOME/.config/hugremote"')]
            code, output = interact(helper + '\nprompt_user_input "QUESTION: " "" ANSWER\nprintf "RESULT=%s\\n" "$ANSWER"\n',
                                    [('QUESTION: ', '$(printf EXECUTED)')])
            self.assertEqual(code, 0, output)
            self.assertIn('RESULT=$(printf EXECUTED)', output)


if __name__ == "__main__":
    unittest.main()
