"""Adapter Codex (viết cho ≥0.163; payload/đầu ra đo trên 0.169.0 — S26, S27) ↔ hợp đồng hook Claude (lld §6.2–§6.6).

Đã đo: payload `Bash` (C-codex-004), `apply_patch` = toàn văn patch ở `tool_input.command` (C-codex-007),
`agent_type` của subagent (C-codex-008), Stop `{"decision":"block"}` (C-codex-009), chặn bằng stdout
`permissionDecision="deny"` (C-codex-003, C-codex-010), `request_user_input` (C-codex-012), SessionStart:compact
(C-codex-013), tên tool MCP `mcp__<server '-'→'_'>__<tool>` (C-codex-015). Đổi version Codex thì kiểm lại.
"""
from __future__ import annotations

import json
import os
import re
import shlex
from pathlib import Path

from ds_scope import ds_active, guarded_by_ds, rewrite_whole_file

SHELL_TOOLS = {"Bash", "shell", "local_shell", "exec_command", "unified_exec", "container.exec"}
PATCH_TOOLS = {"apply_patch"}
KNOWN_TOOLS = SHELL_TOOLS | PATCH_TOOLS | {
    "request_user_input", "update_plan", "spawn_agent", "send_input", "wait", "close_agent", "resume_agent",
    "view_image", "write_stdin", "list_mcp_resources", "list_mcp_resource_templates", "read_mcp_resource",
    "request_permissions", "Agent",
    # 0.169 (S26): tool cộng tác mang tiền tố namespace trong payload hook
    "collaborationspawn_agent", "collaborationwait_agent", "collaborationsend_message", "collaborationfollowup_task",
    "collaborationinterrupt_agent", "collaborationlist_agents", "create_goal", "get_goal", "update_goal",
}
SHELLS = {"sh", "bash", "zsh", "dash"}
COMPOUND = re.compile(r"[;&|()<>`$\n]")


def project_root(raw: dict, default: Path) -> Path:
    # Lệnh hook tự đi ngược từ cwd tìm scripts/kit/hookrun.py (hooks.json) → DEFAULT_ROOT đã là gốc dự án.
    return default


def _abs(path: str, base: Path) -> str:
    """Như Codex: không mở rộng `~`, không theo symlink — chuẩn hoá theo chữ (`a/../b` → `b`)."""
    if not path:
        return ""
    p = Path(path)
    return os.path.normpath(str(p if p.is_absolute() else base / p))


def unwrap_shell(command) -> str:
    """`["bash","-lc","<s>"]` hoặc `bash -lc "<s>"` → `<s>`; danh sách khác → nối lại theo shell."""
    if isinstance(command, list):
        words = [str(w) for w in command]
    else:
        text = str(command or "")
        try:
            words = shlex.split(text)
        except ValueError:
            return text
        if not (len(words) == 3 and os.path.basename(words[0]) in SHELLS and words[1] in ("-c", "-lc")):
            return text
    if len(words) == 3 and os.path.basename(words[0]) in SHELLS and words[1] in ("-c", "-lc"):
        return words[2]
    return shlex.join(words)


# ------------------------------------------------------------------ apply_patch

class PatchError(ValueError):
    pass


MARKER = re.compile(r"^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$")


def parse_patch(text: str) -> list[dict]:
    """Toàn văn `*** Begin Patch … *** End Patch` → [{op: add|update|delete, path, move_to, lines|chunks}].
    Marker so sau khi trim (applier Codex chấp nhận marker có khoảng trắng đầu dòng); dòng hunk giữ nguyên."""
    lines = text.replace("\r\n", "\n").split("\n")
    marker = lambda ln: ln.strip()  # noqa: E731
    i = 0
    while i < len(lines) and marker(lines[i]) != "*** Begin Patch":
        i += 1
    if i == len(lines):
        raise PatchError("thiếu *** Begin Patch")
    i += 1
    ops: list[dict] = []
    while i < len(lines):
        line = marker(lines[i])
        if line == "*** End Patch":
            return ops
        if line.startswith("*** Add File: "):
            op = {"op": "add", "path": line[len("*** Add File: "):].strip(), "lines": []}
            i += 1
            while i < len(lines) and not marker(lines[i]).startswith("*** "):
                if not lines[i].startswith("+"):
                    raise PatchError(f"dòng Add File không bắt đầu bằng '+': {lines[i]!r}")
                op["lines"].append(lines[i][1:])
                i += 1
            ops.append(op)
            continue
        if line.startswith("*** Delete File: "):
            ops.append({"op": "delete", "path": line[len("*** Delete File: "):].strip()})
            i += 1
            continue
        if line.startswith("*** Update File: "):
            op = {"op": "update", "path": line[len("*** Update File: "):].strip(), "move_to": None, "chunks": []}
            i += 1
            if i < len(lines) and marker(lines[i]).startswith("*** Move to: "):
                op["move_to"] = marker(lines[i])[len("*** Move to: "):].strip()
                i += 1
            chunk = None
            while i < len(lines) and (not marker(lines[i]).startswith("*** ") or marker(lines[i]) == "*** End of File"):
                cur = lines[i]
                if marker(cur) == "*** End of File":
                    if chunk is not None:
                        chunk["eof"] = True
                elif cur.startswith("@@"):
                    # Codex chỉ bỏ tiền tố "@@ ", giữ nguyên thụt lề của ngữ cảnh.
                    chunk = {"ctx": cur[3:] if cur.startswith("@@ ") else None, "old": [], "new": [], "keep": [], "eof": False}
                    op["chunks"].append(chunk)
                else:
                    if chunk is None:  # hunk đầu được phép thiếu @@
                        chunk = {"ctx": None, "old": [], "new": [], "keep": [], "eof": False}
                        op["chunks"].append(chunk)
                    tag, body = (cur[:1], cur[1:]) if cur else (" ", "")
                    if tag == " ":
                        chunk["keep"].append((len(chunk["old"]), len(chunk["new"])))
                        chunk["old"].append(body)
                        chunk["new"].append(body)
                    elif tag == "-":
                        chunk["old"].append(body)
                    elif tag == "+":
                        chunk["new"].append(body)
                    else:
                        raise PatchError(f"dòng hunk lạ: {cur!r}")
                i += 1
            if not op["chunks"]:
                raise PatchError(f"Update File {op['path']} không có hunk")
            ops.append(op)
            continue
        if line == "":
            i += 1
            continue
        raise PatchError(f"dòng lạ: {lines[i]!r}")
    raise PatchError("thiếu *** End Patch")


_PUNCT = str.maketrans({
    **dict.fromkeys("‐‑‒–—―−", "-"),
    **dict.fromkeys("‘’‚‛", "'"),
    **dict.fromkeys("“”„‟", '"'),
    **dict.fromkeys("            　", " "),
})
NORMS = (lambda s: s, str.rstrip, str.strip, lambda s: s.strip().translate(_PUNCT))


def _seek(lines: list[str], pattern: list[str], start: int, eof: bool) -> int | None:
    """Như `seek_sequence` của Codex (C-codex-023): quét từ `start` (`eof` → từ max(cuối file − n, `start`)),
    lần lượt khớp chính xác → bỏ khoảng trắng cuối → bỏ khoảng trắng hai đầu → đổi dấu gạch/nháy/khoảng trắng
    Unicode về ASCII."""
    if not pattern:
        return start
    n = len(pattern)
    if n > len(lines):
        return None
    first = max(len(lines) - n, start) if eof else start
    starts = list(range(first, len(lines) - n + 1))
    for norm in NORMS:
        want = [norm(p) for p in pattern]
        for s in starts:
            if [norm(x) for x in lines[s:s + n]] == want:
                return s
    return None


def apply_update(text: str, chunks: list[dict]) -> str:
    lines = text.split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    idx = 0
    repl: list[tuple[int, int, list[str]]] = []
    for ch in chunks:
        if ch["ctx"] is not None:
            at = _seek(lines, [ch["ctx"]], idx, False)
            if at is None:
                raise PatchError(f"không thấy ngữ cảnh {ch['ctx']!r}")
            idx = at + 1
        old, new = ch["old"], ch["new"]
        if not old:  # hunk chỉ thêm dòng → nối cuối file
            repl.append((len(lines), 0, new))
            continue
        at = _seek(lines, old, idx, ch["eof"])
        if at is None and old[-1] == "":
            old = old[:-1]
            new = new[:-1] if new and new[-1] == "" else new
            at = _seek(lines, old, idx, ch["eof"])
        if at is None:
            raise PatchError("hunk không khớp nội dung file")
        # Như Codex (file_update.rs): dòng ngữ cảnh giữ nguyên chữ GỐC của file (khớp mờ không đổi nó),
        # chỉ thay các đoạn giữa hai dòng ngữ cảnh.
        o0 = n0 = 0
        for oc, nc in ch.get("keep", []):
            if oc >= len(old) or nc >= len(new):
                break
            if o0 != oc or n0 != nc:
                repl.append((at + o0, oc - o0, new[n0:nc]))
            o0, n0 = oc + 1, nc + 1
        if o0 != len(old) or n0 != len(new):
            repl.append((at + o0, len(old) - o0, new[n0:]))
        idx = at + len(old)
    for at, n, new in sorted(repl, key=lambda r: r[0], reverse=True):
        lines[at:at + n] = new
    return "\n".join(lines) + "\n"


def _blocked(path: str, root: Path) -> dict:
    return {"tool_name": "Write", "tool_input": {"file_path": path}, "_block": rewrite_whole_file(path)}


def patch_payloads(patch: str, base: Path, root: Path) -> list[dict]:
    """Mỗi file bị ghi → một payload `Write{file_path, content sau ghi}` (lld §6.2), áp TUẦN TỰ trên trạng thái ảo
    (nhiều op cùng file trong một patch — như Codex). Không dựng được → fail-closed trên path guard_ds soi."""
    try:
        ops = parse_patch(patch)
    except PatchError:
        # Không hiểu patch: chặn nếu có path guard_ds soi, hoặc không trích được path nào khi DS đang có hiệu lực.
        paths = [_abs(m.group(1).strip(), base) for ln in patch.split("\n") if (m := MARKER.match(ln.strip()))]
        hit = next((p for p in paths if guarded_by_ds(p, root)), None)
        if hit or (not paths and ds_active(root)):
            return [_blocked(hit or "prototype/", root)]
        return [{"tool_name": "Write", "tool_input": {"file_path": p}, "_passthrough": True} for p in paths] or \
            [{"tool_name": "Write", "tool_input": {"file_path": ""}, "_passthrough": True}]
    state: dict[str, str | None] = {}   # path → nội dung ảo (None = đã xoá)
    broken: set[str] = set()            # path không dựng được nội dung
    touched: list[str] = []

    def current(path: str) -> str | None:
        if path in state:
            return state[path]
        try:
            return Path(path).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return None

    for op in ops:
        path = _abs(op["path"], base)
        touched.append(path)
        if op["op"] == "delete":
            state[path] = None
            broken.discard(path)
            continue
        if op["op"] == "add":
            state[path] = "\n".join(op["lines"]) + "\n"
            broken.discard(path)
            continue
        target = _abs(op["move_to"], base) if op.get("move_to") else path
        touched.append(target)
        text = current(path)
        content = None
        if text is not None and path not in broken:
            try:
                content = apply_update(text, op["chunks"])
            except PatchError:
                content = None
        if target != path:
            state[path] = None
        if content is None:
            broken.add(target)
            state.pop(target, None)
        else:
            state[target] = content
            broken.discard(target)
    out: list[dict] = []
    for path in dict.fromkeys(touched):
        if path in broken:
            out.append(_blocked(path, root) if guarded_by_ds(path, root)
                       else {"tool_name": "Write", "tool_input": {"file_path": path}, "_passthrough": True})
        elif state.get(path) is not None:
            out.append({"tool_name": "Write", "tool_input": {"file_path": path, "content": state[path]}})
        else:  # xoá — guard_agent vẫn thấy một thao tác ghi
            out.append({"tool_name": "Write", "tool_input": {"file_path": path}, "_passthrough": True})
    return out


def _policy_ask(root: Path) -> list[list[str]]:
    try:
        data = json.loads((root / ".viper-kit" / "policy.json").read_text(encoding="utf-8"))
        return [str(p).split() for p in data.get("ask", [])]
    except (OSError, ValueError, AttributeError):
        return []


def native_ask(command: str, root: Path) -> bool:
    """Rule `prompt` của Codex chắc chắn khớp: lệnh đơn, các từ đầu (tách thô theo khoảng trắng — không bóc
    `env`/`VAR=`/nháy/`\\`) trùng nguyên văn một tiền tố ask. Còn lại hook phải tự giữ (lld §8.3)."""
    if COMPOUND.search(command) or "\\" in command:
        return False
    words = command.split()
    return any(words[:len(p)] == p for p in _policy_ask(root))


PATCH_CMD = re.compile(r"^\s*(?:apply_patch|applypatch)\b")


# ------------------------------------------------------------------ payload

def to_claude(raw: dict, root: Path) -> tuple[list[dict], str | None]:
    name = str(raw.get("tool_name") or "")
    args = raw.get("tool_input")
    base = Path(raw["cwd"]) if isinstance(raw.get("cwd"), str) and raw["cwd"] else root
    agent = raw.get("agent_type") if isinstance(raw.get("agent_type"), str) else ""
    payloads: list[dict]
    unknown = None
    if name in SHELL_TOOLS:
        cmd = (args.get("command") or args.get("cmd")) if isinstance(args, dict) else args
        if isinstance(cmd, list) and cmd and os.path.basename(str(cmd[0])) in ("apply_patch", "applypatch") and len(cmd) > 1:
            return _with_agent(patch_payloads(str(cmd[1]), base, root), agent), None
        command = unwrap_shell(cmd)
        if PATCH_CMD.match(command) and "*** Begin Patch" in command:  # `apply_patch <<'EOF' … EOF` qua shell
            body = command[command.index("*** Begin Patch"):]
            end = body.find("*** End Patch")
            return _with_agent(patch_payloads(body[:end + len("*** End Patch")] if end >= 0 else body, base, root), agent), None
        if not command.strip():
            unknown = f"{name}(lệnh rỗng)"
        bare = isinstance(cmd, str) and command == cmd   # không bóc lớp nào: rule chắc chắn thấy đúng chuỗi này
        payloads = [{"tool_name": "Bash", "tool_input": {"command": command}, "_native_ask": bare and native_ask(command, root)}]
    elif name in PATCH_TOOLS:
        patch = args if isinstance(args, str) else next(
            (args.get(k) for k in ("command", "input", "patch") if isinstance(args, dict) and isinstance(args.get(k), str)), "")
        payloads = patch_payloads(patch or "", base, root)
    elif name == "write_stdin":
        # unified_exec (stable, bật mặc định ở 0.169): gõ vào shell tương tác đang mở — soi `chars` như một lệnh
        # Bash để guard_bc/guard_policy không bị lách (mã rust-v0.169.0 write_stdin.rs: `chars`). Payload hook
        # của tool này chưa bắt thật (S28).
        chars = args.get("chars") if isinstance(args, dict) else None
        if isinstance(chars, str) and chars.strip():
            payloads = [{"tool_name": "Bash", "tool_input": {"command": chars.strip()}, "_native_ask": False}]
        else:
            payloads = [{"tool_name": name, "tool_input": {}, "_passthrough": True}]
    elif name == "request_user_input":
        payloads = [{"tool_name": "AskUserQuestion", "tool_input": {}}]
    elif name.startswith("mcp__"):
        payloads = [{"tool_name": name, "tool_input": {}, "_passthrough": True}]
    else:
        payloads = [{"tool_name": name, "tool_input": {}, "_passthrough": True}]
        unknown = None if name in KNOWN_TOOLS else name
    return _with_agent(payloads, agent), unknown


def _with_agent(payloads: list[dict], agent: str) -> list[dict]:
    if agent:
        for p in payloads:
            p["agent"] = agent
    return payloads


# ------------------------------------------------------------------ đầu ra

def _pre(decision: str, reason: str) -> str:
    return json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": decision,
                                              "permissionDecisionReason": reason}}, ensure_ascii=False)


def emit_allow() -> tuple[str, int]:
    return "", 0


def emit_block(reason: str) -> tuple[str, int]:
    return _pre("deny", reason), 0                      # C-codex-003 (đã đo: chặn, model nhận lý do)


# Rule `prompt` có thật sự hỏi Authority ở TUI chưa đo (S28; ở `codex exec` nó từ chối — C-codex-010). Chưa có E3
# thì không dựa vào nó (PROCESS R4): mục ask luôn bị chặn. Bật sau khi S28 xác nhận.
NATIVE_ASK_VERIFIED = False


def emit_ask(reason: str, payload: dict | None = None) -> tuple[str, int]:
    """Mục ask (lld §8.3). Khi `NATIVE_ASK_VERIFIED`: rule `prompt` chắc chắn khớp → để Codex hỏi (native);
    không chắc (lệnh ghép/redirect, bọc `env`/`VAR=`/`sh -c`…) → chặn, yêu cầu chạy đúng dạng trần.
    Khi chưa: luôn chặn, yêu cầu Authority tự chạy lệnh."""
    if not NATIVE_ASK_VERIFIED:
        return _pre("deny", f"{reason} Trên Codex kit chưa kiểm được Codex có tự hỏi Authority cho lệnh này (spike S28) "
                            "— dừng lại, báo Authority lệnh cần chạy để Authority tự chạy."), 0
    if payload and payload.get("_native_ask"):
        return "", 0
    return _pre("deny", f"{reason} Ở dạng này Codex không tự hỏi được — chạy riêng đúng dạng trần (vd `git push …`, "
                        "không ghép `&&`/`;`/`|`/`>`, không bọc `env`/`VAR=`/`sh -c`) để Codex xin Authority duyệt."), 0


def emit_context(text: str) -> tuple[str, int]:
    return json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": text}},
                      ensure_ascii=False), 0


def emit_continue(reason: str) -> tuple[str, int]:
    return json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False), 0  # Stop: ép chạy tiếp (docs Codex)


def compacted_since_last(raw: dict, root: Path) -> bool:
    return raw.get("source") == "compact"               # SessionStart matcher `compact` — Codex báo thẳng


def stop_message(raw: dict) -> str | None:
    """Stop: văn bản cuối lượt; None khi hook Stop đã ép chạy tiếp một lần (tránh vòng lặp)."""
    if raw.get("stop_hook_active"):
        return None
    msg = raw.get("last_assistant_message")
    return msg if isinstance(msg, str) else None
