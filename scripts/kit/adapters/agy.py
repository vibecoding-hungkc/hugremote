"""Adapter agy (Antigravity CLI ≥1.5.5) ↔ hợp đồng hook Claude (lld §6.2–§6.6).

Mọi hằng số dưới đây dẫn claim trong research/claims.md — đổi version agy thì kiểm lại.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

# Tool agy → tool Claude (C-agy-012, C-agy-025).
KNOWN_TOOLS = {
    "run_command", "write_file", "edit_file", "read_file", "ask_question", "call_mcp_tool",
    "invoke_subagent", "send_message", "manage_task", "list_resources", "read_resource",
}


def project_root(raw: dict, default: Path) -> Path:
    paths = raw.get("workspacePaths") or []
    return Path(paths[0]) if paths and isinstance(paths[0], str) else default


def _abs(path: str, base: Path) -> str:
    if not path:
        return ""
    p = Path(os.path.expanduser(path))
    return str(p if p.is_absolute() else base / p)


def to_claude(raw: dict, root: Path) -> tuple[list[dict], str | None]:
    """PreToolUse agy → danh sách payload Claude. Trả (payloads, unknown_tool)."""
    call = raw.get("toolCall") or {}
    name = str(call.get("name") or "")
    args = call.get("args") if isinstance(call.get("args"), dict) else {}
    base = Path(raw["cwd"]) if isinstance(raw.get("cwd"), str) and raw["cwd"] else root  # lld §6.2: path tương đối theo cwd
    if name == "run_command":
        return [{"tool_name": "Bash", "tool_input": {"command": str(args.get("CommandLine") or "")}}], None
    if name == "write_file":
        return [{"tool_name": "Write", "tool_input": {
            "file_path": _abs(str(args.get("Path") or ""), base),
            "content": str(args.get("Content") or "")}}], None
    if name == "edit_file":
        path = _abs(str(args.get("Path") or ""), base)
        target, repl = str(args.get("Target") or ""), str(args.get("Replacement") or "")
        try:
            text = Path(path).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            text = None
        # edit_file khớp chính xác, thay mọi chỗ (C-agy-013). Target không có / file không đọc được
        # → tool cũng sẽ lỗi → không dựng nội dung, guard VIPER bỏ qua (passthrough).
        if text is not None and target and target in text:
            return [{"tool_name": "Write", "tool_input": {
                "file_path": path, "content": text.replace(target, repl)}}], None
        return [{"tool_name": "Write", "tool_input": {"file_path": path}, "_passthrough": True}], None
    if name == "read_file":
        return [{"tool_name": "Read", "tool_input": {"file_path": _abs(str(args.get("Path") or ""), base)}}], None
    if name == "ask_question":
        return [{"tool_name": "AskUserQuestion", "tool_input": {}}], None
    if name == "call_mcp_tool":
        server, tool = str(args.get("ServerName") or ""), str(args.get("ToolName") or "")
        return [{"tool_name": f"mcp__{server}__{tool}", "tool_input": {}, "_passthrough": True}], None
    return [{"tool_name": name, "tool_input": {}, "_passthrough": True}], (None if name in KNOWN_TOOLS else name)


def emit_allow() -> tuple[str, int]:
    return "", 0                      # stdout rỗng = trung lập; `{}` là CHẶN (C-agy-005)


def emit_block(reason: str) -> tuple[str, int]:
    return json.dumps({"decision": "deny", "reason": reason}, ensure_ascii=False), 0   # C-agy-025


def emit_ask(reason: str, _payload: dict | None = None) -> tuple[str, int]:
    return json.dumps({"decision": "force_ask", "reason": reason}, ensure_ascii=False), 0  # C-agy-009


def emit_context(text: str) -> tuple[str, int]:
    return json.dumps({"injectSteps": [{"systemMessage": {"systemMessage": text}}]}, ensure_ascii=False), 0  # C-agy-010


def count_checkpoints(transcript: str) -> int:
    """Số step CHECKPOINT (dấu vết compact — C-agy-011). Không đọc được → -1."""
    try:
        n = 0
        with open(transcript, encoding="utf-8") as fh:
            for line in fh:
                if '"CHECKPOINT"' not in line:
                    continue
                try:
                    if json.loads(line).get("type") == "CHECKPOINT":
                        n += 1
                except ValueError:
                    continue
        return n
    except OSError:
        return -1


def compacted_since_last(raw: dict, root: Path) -> bool:
    """PreInvocation: True nếu số CHECKPOINT tăng so với lần trước của cùng conversationId."""
    conv = str(raw.get("conversationId") or "")
    transcript = str(raw.get("transcriptPath") or "")
    if not conv or not transcript:
        return False
    now = count_checkpoints(os.path.expanduser(transcript))
    if now < 0:
        return False
    state_path = root / ".viper" / "kit" / "agy-checkpoints.json"
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        state = {}
    before = state.get(conv)
    state[conv] = now
    try:  # ghi atomic — nhiều subagent có thể gọi song song
        state_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = state_path.with_name(f"{state_path.name}.{os.getpid()}.tmp")
        tmp.write_text(json.dumps(state, indent=1) + "\n", encoding="utf-8")
        os.replace(tmp, state_path)
    except OSError:
        pass
    return before is not None and now > int(before)
