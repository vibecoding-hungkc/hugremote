#!/usr/bin/env python3
"""guard_agent.py — giới hạn tool theo subagent cho provider không có whitelist native (lld §7.1, D4).

stdin : payload dạng Claude {"tool_name", "tool_input", "agent"} — adapter điền `agent` (Codex: `agent_type`)
policy: <gốc dự án>/.viper-kit/agent-policy.json — sinh từ frontmatter `.claude/agents/*.md`
        {"<agent>": {"allow": [...], "allow_mcp": [...]} | {"deny": [...], "deny_mcp": [...]}}
exit  : 0 cho qua · 2 chặn (stderr = lý do). Agent không có trong policy / lỗi đọc → 0 (fail-open như guard VIPER).
Chỉ xét tool Claude có nghĩa với whitelist (đọc/ghi/shell/hỏi/MCP); tool nội bộ của provider (update_plan…) cho qua.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
WRITE = {"Write", "Edit", "MultiEdit", "NotebookEdit"}
CONTROLLED = WRITE | {"Read", "Grep", "Glob", "Bash", "AskUserQuestion"}


def norm_server(name: str) -> str:
    return name.replace("-", "_")                       # Codex: `pw-slot-1` → `mcp__pw_slot_1__…` (S20)


def expand(tools: list[str]) -> set[str]:
    """Ghi file trên provider khác đều quy về `Write` (lld §6.2) → có Write/Edit/MultiEdit là có cả nhóm."""
    s = set(tools)
    return s | WRITE if s & WRITE else s


def check(agent: str, tool: str, rule: dict) -> str | None:
    if tool.startswith("mcp__"):
        server = norm_server(tool[5:].split("__")[0])
        if "allow" in rule:
            if server not in {norm_server(x) for x in rule.get("allow_mcp", [])}:
                return f"agent `{agent}` không được dùng server MCP `{server}` (chỉ: {', '.join(rule.get('allow_mcp', [])) or 'không có'})"
        elif server in {norm_server(x) for x in rule.get("deny_mcp", [])}:
            return f"agent `{agent}` không được dùng server MCP `{server}` — khe dogfood chỉ dùng trình duyệt của chính nó"
        return None
    if tool not in CONTROLLED:
        return None
    if "allow" in rule:
        if tool not in expand(rule["allow"]):
            return f"agent `{agent}` chỉ được dùng {', '.join(rule['allow'])} — không được `{tool}`"
    elif tool in expand(rule.get("deny", [])):
        return f"agent `{agent}` không được `{tool}`"
    return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        policy = json.loads((ROOT / ".viper-kit" / "agent-policy.json").read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return 0
    agent = str(payload.get("agent") or "")
    rule = policy.get(agent)
    if not agent or not isinstance(rule, dict):
        return 0
    reason = check(agent, str(payload.get("tool_name") or ""), rule)
    if reason:
        sys.stderr.write(f"[viper-kit guard_agent] CHẶN — {reason} (.viper-kit/agent-policy.json — rút từ khai báo agent `{agent}` của VIPER).\n")
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001 — fail-open như guard VIPER
        sys.exit(0)
