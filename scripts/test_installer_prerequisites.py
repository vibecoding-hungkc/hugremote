"""Run installer preflights with simulated tools; never install OS packages."""
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class InstallerPrerequisites(unittest.TestCase):
    def run_preflight(self, script, *, missing="make gcc g++ python3", manager=True,
                      root=False, sudo=True, fail=False, repair=True, os_name="Linux"):
        # Only execute the real installer prefix, before clone/configuration/build.
        prefix = (ROOT / script).read_text().split("# 3. Xác định thư mục cài đặt")[0]
        harness = r'''
installed=0
command() {
  if [ "$1" = -v ]; then
    case "$2" in
      make|gcc|g++|python3)
        if [[ " $MISSING " == *" $2 "* ]] && [ "$installed" = 0 ]; then return 1; fi
        return 0 ;;
      apt-get) [ "$MANAGER" = 1 ]; return ;;
      sudo) [ "$HAS_SUDO" = 1 ]; return ;;
    esac
  fi
  builtin command "$@"
}
make() { :; }
gcc() { :; }
g++() { :; }
python3() { :; }
uname() { printf '%s\n' "$OS_NAME"; }
node() { printf 'v20.20.2\n'; }
npm() { printf '10.8.2\n'; }
id() { printf '%s\n' "$USER_ID"; }
sudo() { printf 'SUDO\n'; "$@"; }
apt-get() {
  printf 'APT:%s\n' "$*"
  [ "$FAIL_INSTALL" = 0 ] || return 1
  if [ "$1" = install ] && [ "$REPAIR" = 1 ]; then installed=1; fi
}
'''
        import os
        env = dict(os.environ, MISSING=missing, MANAGER=str(int(manager)),
                   USER_ID="0" if root else "1000", HAS_SUDO=str(int(sudo)),
                   FAIL_INSTALL=str(int(fail)), REPAIR=str(int(repair)), OS_NAME=os_name)
        return subprocess.run(["bash"], input=harness + prefix + '\necho PREFLIGHT_OK\n',
                              text=True, capture_output=True, env=env, timeout=10)

    def test_missing_tools_installed_before_build(self):
        for script in ("beta.sh", "install.sh"):
            with self.subTest(script=script):
                result = self.run_preflight(script)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn("APT:update", result.stdout)
                self.assertIn("APT:install -y build-essential python3", result.stdout)
                self.assertIn("PREFLIGHT_OK", result.stdout)

    def test_preflight_scenarios(self):
        cases = [
            ({"missing": ""}, True, False),
            ({"missing": "make"}, True, True),
            ({"root": True, "sudo": False}, True, True),
            ({"sudo": False}, False, False),
            ({"manager": False}, False, False),
            ({"fail": True}, False, True),
            ({"repair": False}, False, True),
            ({"os_name": "Darwin"}, False, False),
        ]
        for script in ("beta.sh", "install.sh"):
            for options, success, installs in cases:
                with self.subTest(script=script, options=options):
                    result = self.run_preflight(script, **options)
                    self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
                    self.assertEqual("PREFLIGHT_OK" in result.stdout, success)
                    self.assertEqual("APT:update" in result.stdout, installs)
                    if not success:
                        self.assertIn("chạy lại installer", result.stderr)
                    if options.get("root"):
                        self.assertNotIn("SUDO", result.stdout)

    def test_install_errors_are_not_hidden(self):
        for script in ("beta.sh", "install.sh"):
            with self.subTest(script=script):
                text = (ROOT / script).read_text()
                self.assertNotIn("npm install --silent", text)
                self.assertIn("npm install --foreground-scripts", text)


if __name__ == "__main__":
    unittest.main()
