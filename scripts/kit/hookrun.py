#!/usr/bin/env python3
"""hookrun.py — dispatcher hook của viper-kit (lld §6.1).

    python3 scripts/kit/hookrun.py <provider> <event> <guard,guard…|auto>

Dịch payload của provider sang hợp đồng hook Claude, gọi NGUYÊN BẢN guard VIPER
(scripts/guard_*.py, reanchor.py) và guard của kit (scripts/kit/guard_*.py), rồi dịch
kết luận ngược lại. Dispatcher không bao giờ để lỗi của chính nó lọt ra provider:
mọi ngoại lệ → cho qua + heartbeat `errors` (giữ tinh thần fail-open của VIPER — lld §6.4).
"""
from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
import time
from pathlib import Path

KIT = Path(__file__).resolve().parent
DEFAULT_ROOT = KIT.parent.parent
sys.path.insert(0, str(KIT))

try:
    import heartbeat  # noqa: E402
except Exception:  # noqa: BLE001 — thiếu heartbeat không được làm hook lỗi (Hermes fail_closed, agy fail-closed)
    class heartbeat:  # type: ignore[no-redef]
        @staticmethod
        def touch(*_a, **_k) -> None:
            return None

VIPER_GUARDS = {"guard_ask", "guard_bc", "guard_ds", "reanchor"}
QUESTION_END = ("?", "？")
ROUTES = {
    "AskUserQuestion": ["guard_ask"],
    "Bash": ["guard_bc", "guard_policy"],
    "Write": ["guard_ds", "guard_policy"],
    "Read": ["guard_policy"],
}
DEFAULT_ROUTE = ["guard_policy"]
BUDGET = 25.0  # tổng mọi guard trong một lượt < timeout 30s của hook agy (fail-closed — C-agy-006)
DEADLINE = time.monotonic() + BUDGET


def load_adapter(provider: str):
    path = KIT / "adapters" / f"{provider}.py"
    spec = importlib.util.spec_from_file_location(f"viper_kit_adapter_{provider}", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_rewrite(provider: str) -> tuple[list[str], list[tuple[re.Pattern, str]]]:
    """Bảng viết lại lld §5 do renderer ghi (scripts/kit/rewrite-<p>.json) — cùng bảng với src/render/rewrite.js."""
    try:
        data = json.loads((KIT / f"rewrite-{provider}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return [], []
    rules = [(re.compile(r["re"]), re.sub(r"\$(\d)", r"\\g<\1>", r["to"])) for r in data.get("rules", [])]
    return sorted(data.get("keep", []), key=len, reverse=True), rules


def rewrite(text: str, table) -> str:
    keep, rules = table
    held: list[str] = []

    def hold(m: re.Match) -> str:
        held.append(m.group(0))
        return f"\x00K{len(held) - 1}\x00"

    for k in keep:
        text = re.sub(re.escape(k), hold, text)
    for pattern, repl in rules:
        text = pattern.sub(repl, text)
    return re.sub(r"\x00K(\d+)\x00", lambda m: held[int(m.group(1))], text)


def run_guard(name: str, payload: dict, root: Path) -> tuple[int, str, str]:
    script = root / "scripts" / f"{name}.py" if name in VIPER_GUARDS else KIT / f"{name}.py"
    if not script.is_file():
        return 0, "", ""
    body = {k: v for k, v in payload.items() if not k.startswith("_")}
    left = DEADLINE - time.monotonic()
    if left <= 1:
        heartbeat.touch(root, "kit", "guard", error=f"{name}: hết ngân sách thời gian")
        return 0, "", ""
    try:
        proc = subprocess.run([sys.executable, str(script)], input=json.dumps(body), capture_output=True,
                              text=True, encoding="utf-8", timeout=left - 0.5, cwd=str(root))
    except (subprocess.TimeoutExpired, OSError) as exc:
        heartbeat.touch(root, "kit", "guard", error=f"{name}: {exc}")
        return 0, "", ""
    return proc.returncode, proc.stdout, proc.stderr


def extract_context(stdout: str) -> str:
    try:
        return str(json.loads(stdout)["hookSpecificOutput"]["additionalContext"])
    except (ValueError, KeyError, TypeError):
        return ""


def handle_pre(ad, provider: str, raw: dict, root: Path, guards_arg: str, rules) -> tuple[str, int]:
    payloads, unknown = ad.to_claude(raw, root)
    heartbeat.touch(root, provider, "pre", unknown_tool=unknown)
    for payload in payloads:
        if payload.get("_block"):
            return ad.emit_block(payload["_block"])
        guards = ROUTES.get(payload["tool_name"], DEFAULT_ROUTE) if guards_arg == "auto" else guards_arg.split(",")
        if payload.get("agent"):  # subagent có tên (Codex agent_type) → whitelist theo agent trước (lld §7.1)
            guards = ["guard_agent", *guards]
        for g in guards:
            if g in VIPER_GUARDS and payload.get("_passthrough"):
                continue
            code, _out, err = run_guard(g, payload, root)
            if code == 2:
                return ad.emit_block(rewrite(err.strip(), rules) or f"{g}: chặn")
            if code == 3:
                return ad.emit_ask(rewrite(err.strip(), rules) or f"{g}: cần duyệt", payload)
    return ad.emit_allow()


def handle_invocation(ad, provider: str, raw: dict, root: Path, rules) -> tuple[str, int]:
    heartbeat.touch(root, provider, "invocation")
    if not ad.compacted_since_last(raw, root):
        return ad.emit_allow()
    heartbeat.touch(root, provider, "reanchor")
    payload = {"session_id": raw.get("conversationId") or raw.get("session_id") or "", "source": "compact", "cwd": str(root)}
    code, out, _err = run_guard("reanchor", payload, root)
    context = extract_context(out) if code == 0 else ""
    return ad.emit_context(rewrite(context, rules)) if context else ad.emit_allow()


def ends_with_question(text: str) -> bool:
    """Lượt kết thúc bằng câu hỏi: dòng chữ cuối (ngoài khối code) kết thúc bằng `?` — heuristic (lld §6.7)."""
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    lines = [ln.strip().rstrip("*_`> ").strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    return bool(lines) and lines[-1].endswith(QUESTION_END)


def handle_stop(ad, provider: str, raw: dict, root: Path, rules) -> tuple[str, int]:
    """Provider hỏi bằng cách kết thúc lượt (Codex Default mode): câu hỏi ngoài pha V → ép chạy tiếp (luật #2)."""
    heartbeat.touch(root, provider, "stop")
    msg = ad.stop_message(raw)
    if not msg or not ends_with_question(msg):
        return ad.emit_allow()
    code, _out, err = run_guard("guard_ask", {"tool_name": "AskUserQuestion", "tool_input": {}}, root)
    if code != 2:
        return ad.emit_allow()
    heartbeat.touch(root, provider, "stop_ask")
    return ad.emit_continue(rewrite(
        "[viper-kit] Bạn vừa kết thúc lượt bằng một câu hỏi cho Authority. " + err.strip()
        + " Đừng chờ trả lời: tự chọn phương án hợp lý nhất, ghi lý do vào DECISIONS.md rồi làm tiếp. "
        "Nếu bị chặn bởi việc chỉ Authority làm được thì ghi blocker vào STATE.md và kết thúc lượt không đặt câu hỏi.",
        rules))


def main(argv: list[str]) -> tuple[str, int]:
    if len(argv) < 3:
        return "", 0
    provider, event, guards_arg = argv[0], argv[1], argv[2]
    ad = load_adapter(provider)
    try:
        raw = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    root = ad.project_root(raw, DEFAULT_ROOT)
    if not (root / "STATE.md").exists():
        root = DEFAULT_ROOT
    rules = load_rewrite(provider)
    if event == "pre":
        return handle_pre(ad, provider, raw, root, guards_arg, rules)
    if event in ("invocation", "llm", "session"):  # agy PreInvocation · Hermes pre_llm_call · Codex SessionStart:compact
        return handle_invocation(ad, provider, raw, root, rules)
    if event == "stop" and hasattr(ad, "stop_message"):  # Codex Stop
        return handle_stop(ad, provider, raw, root, rules)
    if event == "compacted" and hasattr(ad, "mark_compacted"):  # Hermes post_compaction
        heartbeat.touch(root, provider, "compacted")
        ad.mark_compacted(raw, root)
    return ad.emit_allow()


if __name__ == "__main__":
    try:
        stdout, code = main(sys.argv[1:])
    except Exception as exc:  # noqa: BLE001 — lỗi dispatcher không được chặn mọi tool (agy fail-closed, C-agy-006)
        heartbeat.touch(DEFAULT_ROOT, sys.argv[1] if len(sys.argv) > 1 else "kit", "error", error=repr(exc))
        stdout, code = "", 0
    if stdout:
        sys.stdout.write(stdout)
    sys.exit(code)
