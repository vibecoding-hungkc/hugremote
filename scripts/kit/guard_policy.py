#!/usr/bin/env python3
"""guard_policy.py — allow/ask/deny theo pattern cho provider thiếu native (lld §8, D4).

stdin : payload dạng Claude {"tool_name", "tool_input"} (adapter đã chuẩn hoá tên tool)
policy: <gốc dự án>/.viper-kit/policy.json — sinh từ .claude/settings.json → permissions
exit  : 0 cho qua · 2 chặn (stderr = lý do) · 3 cần người duyệt (stderr = lý do, lld §8.3)
Lỗi đọc payload/policy → 0 (fail-open như guard VIPER).
"""
from __future__ import annotations

import fnmatch
import json
import os
import re
import shlex
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OPERATOR_CHARS = set(";&|(){}")
PREFIX_WORDS = {"env", "time", "nohup", "command", "builtin", "exec", "nice"}
SHELLS = {"sh", "bash", "zsh", "dash"}
ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")


def tokenize(command: str) -> list[str]:
    """Tách theo shell (tôn trọng dấu nháy); toán tử ;&|(){} thành token riêng."""
    lexer = shlex.shlex(command.replace("\n", " ; "), posix=True, punctuation_chars=";&|(){}")
    lexer.whitespace_split = True
    try:
        return list(lexer)
    except ValueError:  # nháy không đóng — tách thô
        return command.split()


def segments(command: str, depth: int = 0) -> list[list[str]]:
    """Lệnh → danh sách lệnh đơn đã chuẩn hoá: bóc VAR=…, env/time/…, mở `sh -c "<s>"`, bỏ option chung của git."""
    out: list[list[str]] = []
    cur: list[str] = []
    for tok in tokenize(command) + [";"]:
        if set(tok) <= OPERATOR_CHARS:
            if cur:
                out.extend(normalize(cur, depth))
            cur = []
        else:
            cur.append(tok)
    return out


def normalize(words: list[str], depth: int) -> list[list[str]]:
    while words and (ASSIGN.match(words[0]) or words[0] in PREFIX_WORDS):
        words = words[1:]
    if depth < 3 and len(words) >= 3 and words[0].rsplit("/", 1)[-1] in SHELLS:
        for i, w in enumerate(words[1:], 1):
            if w.startswith("-") and "c" in w[1:] and i + 1 < len(words):
                return segments(words[i + 1], depth + 1)
    if words and words[0] == "git":
        rest = words[1:]
        while len(rest) >= 2 and rest[0] in ("-C", "-c", "--git-dir", "--work-tree"):
            rest = rest[2:]
        words = ["git", *rest]
    return [words] if words else []


def load_policy() -> dict:
    try:
        return json.loads((ROOT / ".viper-kit" / "policy.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def match_prefix(words: list[str], prefixes: list[str]) -> str | None:
    seg = " ".join(words)
    for prefix in prefixes:
        p = " ".join(prefix.split())
        if seg == p or seg.startswith(p + " "):
            return prefix
    return None


def check_command(command: str, policy: dict) -> tuple[int, str]:
    segs = segments(command)
    for seg in segs:
        hit = match_prefix(seg, policy.get("deny", []))
        if hit:
            return 2, f"[viper-kit guard_policy] CHẶN — lệnh khớp danh sách cấm `{hit}` (.viper-kit/policy.json — rút từ permissions của VIPER)."
    for seg in segs:
        hit = match_prefix(seg, policy.get("ask", []))
        if hit:
            return 3, f"[viper-kit guard_policy] Cần Authority duyệt — lệnh khớp `{hit}` (.viper-kit/policy.json — rút từ permissions của VIPER)."
    return 0, ""


def check_read(file_path: str, policy: dict) -> tuple[int, str]:
    if not file_path:  # tool đọc không trích được path → chặn (lld §6.2): passthrough không được lách deny_read
        return 2, "[viper-kit guard_policy] CHẶN — tool đọc file không có đường dẫn cụ thể; đọc bằng tool có path."
    path = Path(file_path)
    if not path.is_absolute():
        path = ROOT / path
    path = Path(os.path.realpath(str(path)))  # symlink (vd /var → /private/var) không được lách deny_read
    try:
        rel = path.relative_to(ROOT).as_posix()
    except ValueError:
        rel = None
    home = Path(os.path.expanduser("~"))
    for pattern in policy.get("deny_read", []):
        glob = pattern.replace("**", "*")
        if pattern.startswith("~/"):
            target = (home / pattern[2:]).as_posix().replace("**", "*")
            if fnmatch.fnmatchcase(path.as_posix(), target) or fnmatch.fnmatchcase(path.as_posix(), target.rstrip("*").rstrip("/")):
                return 2, f"[viper-kit guard_policy] CHẶN đọc `{pattern}` (.viper-kit/policy.json — rút từ permissions của VIPER)."
        elif rel is not None and (fnmatch.fnmatchcase(rel, glob)
                                  or ("/" not in pattern and fnmatch.fnmatchcase(path.name, glob))):  # ngữ nghĩa gitignore
            return 2, f"[viper-kit guard_policy] CHẶN đọc `{pattern}` (.viper-kit/policy.json — rút từ permissions của VIPER)."
    return 0, ""


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        return 0
    policy = load_policy()
    if not policy:
        return 0
    tool = payload.get("tool_name") or ""
    tool_input = payload.get("tool_input") or {}
    if tool == "Bash":
        code, reason = check_command(str(tool_input.get("command") or ""), policy)
    elif tool == "Read":
        code, reason = check_read(str(tool_input.get("file_path") or ""), policy)
    else:
        code, reason = 0, ""
    if code:
        sys.stderr.write(reason + "\n")
    return code


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001 — fail-open như guard VIPER
        sys.exit(0)
