#!/usr/bin/env python3
"""reanchor.py — nhồi lại luật VIPER vào context sau khi compact.

VÌ SAO CÓ FILE NÀY
    Compact giữ được "đang làm gì", nhưng làm phẳng "đang bị cấm gì". VIPER sống bằng
    ràng buộc thủ tục (không hỏi Authority, ghi DECISIONS trước khi code, challenge, dogfood)
    — đúng loại thứ biến mất đầu tiên trong bản tóm tắt. Hook này chạy ngay sau compact và
    đọc lại luật + trạng thái sống từ file, nên meta không phải nhớ.

CHẠY NHƯ THẾ NÀO
    Claude Code gọi qua hook SessionStart matcher "compact" (xem .claude/settings.json).
    stdin : JSON có session_id · source · cwd · transcript_path
    stdout: JSON có hookSpecificOutput.additionalContext — CHỈ được xử lý khi exit code 0

    Mọi lần chạy đều ghi một dòng vào .viper/reanchor.log để sau còn đo được.

ĐO HIỆU QUẢ
    python3 scripts/reanchor.py --audit
        Đọc log + transcript, đếm số lần compact và soi dấu hiệu phá luật SAU mỗi lần.
        Dùng để trả lời: nhồi lại luật có thật sự giữ được tuân thủ không.

Exit codes: 0 luôn luôn (trừ --audit) — hook lỗi không được phép chặn phiên làm việc.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG = ROOT / ".viper" / "reanchor.log"

# Dấu hiệu phá luật soi được bằng máy trong transcript.
# Chỉ liệt kê thứ ĐO ĐƯỢC — phần còn lại của luật #2 phải đọc tay.
VIOLATION_TOOLS = {"AskUserQuestion": "luật #2 — hỏi Authority sau pha V"}


# --- phần chạy như hook -----------------------------------------------------

def read(rel: str) -> str:
    try:
        return (ROOT / rel).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def phase() -> str:
    # Nhận cả P1/P2 — đồng bộ với gate.py và guard_ask.py.
    m = re.search(r"Pha hiện tại\s*:\s*(V|I|P1|P2|P|E|R)\b", read("STATE.md"))
    return m.group(1) if m else "?"


COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)


def section(text: str, header: str, stop: str = "\n## ") -> str:
    """Một mục của file, đã bỏ khối <!-- --> — hướng dẫn cho người điền, không phải nội dung."""
    i = text.find(header)
    if i < 0:
        return ""
    j = text.find(stop, i + len(header))
    body = text[i : j if j > 0 else len(text)]
    return re.sub(r"\n{3,}", "\n\n", COMMENT.sub("", body)).strip()


SEPARATOR = re.compile(r"^\|[\s|:-]+\|$")


def table_rows(block: str) -> list[str]:
    """Dòng dữ liệu thật của một bảng markdown.

    Thứ tự quan trọng: bỏ dòng phân cách TRƯỚC, rồi mới bỏ đúng MỘT dòng tiêu đề.
    Làm ngược lại (cắt [2:] sau khi đã lọc) là nuốt mất dòng dữ liệu đầu tiên —
    tức là nuốt đúng blocker mới nhất, thứ cần thấy nhất sau compact.
    """
    lines = [l for l in block.splitlines() if l.startswith("|")]
    lines = [l for l in lines if not SEPARATOR.match(l)]
    return [r for r in lines[1:] if r.strip("| ").strip()]


def live_state() -> str:
    """Trạng thái sống, lấy từ file chứ không từ trí nhớ."""
    state = read("STATE.md")
    out = []

    head = state[: state.find("---")] if "---" in state else state[:400]
    # bỏ tiêu đề và dòng blockquote mô tả — chỉ giữ khối pha/ngày/stack/URL
    head = "\n".join(l for l in head.splitlines()
                     if not l.startswith(("# ", "> ", "```")) and l.strip() != ">").strip()
    if head:
        out.append(head)

    for name, header in (("Blocker", "## Blocker"),
                         ("Dogfood chưa xử", "## Phát hiện từ dogfood chưa xử")):
        rows = table_rows(section(state, header))
        if rows:
            out.append(f"**{name} đang mở ({len(rows)}):**\n" + "\n".join(rows))

    ac = section(read("context/PRD.md"), "## 3.")
    if ac:
        out.append("**AC đang bám (PRD §3):**\n" + ac)

    return "\n\n".join(out)


def rules() -> str:
    """Luật đọc THẲNG từ CLAUDE.md, không chép cứng vào đây.

    Chép cứng là tự tạo bản sao thứ tư của luật: sửa CLAUDE.md mà quên file này thì
    hook nhồi luật cũ vào đúng lúc meta đang mất trí nhớ — hỏng hơn là không nhồi gì.
    Không đọc được thì nói thẳng là không đọc được, đừng in bản cũ cho có.
    """
    claude = read("CLAUDE.md")
    blocks = [b for b in (section(claude, "## 1. TÁM LUẬT"),
                          section(claude, "## 3. LUẬT #2")) if b]
    if blocks:
        return "\n\n".join(blocks)
    return ("_Không đọc được `CLAUDE.md` — mở file đó ra đọc §1 và §3 trước khi làm tiếp._")


def build_context(source: str) -> str:
    p = phase()
    return "\n".join([
        f"# VIPER — nhồi lại sau `{source}`",
        "",
        f"Context vừa bị nén. Bản tóm tắt giữ được *đang làm gì* nhưng thường đánh rơi "
        f"*đang bị cấm gì*. Dưới đây là luật đọc thẳng từ `CLAUDE.md`. "
        f"Pha hiện tại: **{p}**.",
        "",
        rules(),
        "",
        "## Trạng thái sống",
        "",
        live_state() or "_(chưa đọc được STATE.md)_",
        "",
        "## Trước khi làm tiếp",
        "",
        f"Chạy `python3 scripts/gate.py` để biết gate pha {p} còn thiếu gì. "
        "Nếu không chắc đang dở việc gì, đọc `STATE.md` rồi làm nốt AC gần nhất — "
        "đừng mở việc mới.",
    ])


def log_fire(payload: dict) -> None:
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps({
                "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "source": payload.get("source", "?"),
                "session_id": payload.get("session_id", "?"),
                "transcript": payload.get("transcript_path", ""),
                "phase": phase(),
            }, ensure_ascii=False) + "\n")
    except OSError:
        pass  # log hỏng thì kệ, không được để hook chặn phiên


def run_hook() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        payload = {}

    log_fire(payload)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": build_context(payload.get("source", "compact")),
        }
    }, ensure_ascii=False))
    return 0


# --- phần đo hiệu quả -------------------------------------------------------

def iter_records(path: Path):
    try:
        with path.open(encoding="utf-8") as f:
            for line in f:
                try:
                    yield json.loads(line)
                except (json.JSONDecodeError, ValueError):
                    continue
    except OSError:
        return


def parse_ts(s: str):
    """ISO-8601 → datetime có múi giờ. Log ghi '+00:00', transcript ghi 'Z' —
    so sánh bằng chuỗi sẽ sai ở ranh giới, nên phải parse thật."""
    try:
        d = datetime.fromisoformat((s or "").replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def tools_after(transcript: Path, after_iso: str) -> list[tuple[str, str]]:
    """Tool đã gọi sau mốc thời gian, kèm timestamp."""
    mark = parse_ts(after_iso)
    if mark is None:
        return []
    found = []
    for rec in iter_records(transcript):
        if rec.get("type") != "assistant":
            continue
        ts = rec.get("timestamp", "")
        t = parse_ts(ts)
        if t is None or t <= mark:
            continue
        for block in (rec.get("message") or {}).get("content") or []:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                found.append((ts, block.get("name", "?")))
    return found


def audit() -> int:
    if not LOG.exists():
        print("Chưa có .viper/reanchor.log — hook chưa chạy lần nào.")
        print("Nghĩa là phiên làm việc chưa từng compact, hoặc hook chưa được nối.")
        print("Kiểm nối hook: grep -A6 SessionStart .claude/settings.json")
        return 0

    fires = [json.loads(l) for l in LOG.read_text(encoding="utf-8").splitlines() if l.strip()]
    print(f"\n=== Đã compact {len(fires)} lần ===\n")

    total_viol = 0
    for i, fire in enumerate(fires, 1):
        print(f"[{i}] {fire['at']}  ·  pha {fire['phase']}  ·  {fire['source']}")
        tp = Path(fire.get("transcript") or "")
        if not tp.is_file():
            print("    (không đọc được transcript — bỏ qua)\n")
            continue

        after = tools_after(tp, fire["at"])
        print(f"    {len(after)} lượt gọi tool sau mốc này")

        # Luật #2 chỉ có hiệu lực TỪ PHA I. Ở pha V, hỏi Authority là việc bắt buộc —
        # tính nó là vi phạm thì phép đo tự sinh ra dương tính giả.
        if fire["phase"] == "V":
            print("    · pha V — hỏi Authority là đúng luật, không soi AskUserQuestion")
            print()
            continue

        viol = [(ts, n) for ts, n in after if n in VIOLATION_TOOLS]
        total_viol += len(viol)
        if viol:
            for ts, n in viol:
                print(f"    ✗ {ts}  {n} — {VIOLATION_TOOLS[n]}")
        else:
            print("    ✓ không có dấu hiệu phá luật đo được bằng máy")
        print()

    print("=" * 60)
    print(f"Tổng vi phạm đo được bằng máy: {total_viol}")
    print("""
Đọc kết quả này thế nào:
  · 0 vi phạm KHÔNG chứng minh hook có tác dụng — có thể phiên đó vốn không định hỏi.
    Muốn kết luận thật thì cần đối chứng: chạy một pha I có hook và một pha I không hook,
    trên cùng một PRD, rồi so.
  · Máy chỉ soi được AskUserQuestion. Ba thứ nặng hơn phải đọc tay:
      - quyết định không hiển nhiên mà thiếu dòng DECISIONS.md
      - báo "xong" khi chưa chạy /viper-dogfood
      - lặng lẽ nới scope đã khoá
  · Vì vậy hãy ghi cả cảm nhận vào context/EXPERIMENTS.md — số liệu máy chỉ là một nửa.
""")
    return 0


if __name__ == "__main__":
    if "--audit" in sys.argv:
        sys.exit(audit())
    try:
        sys.exit(run_hook())
    except Exception as e:  # hook KHÔNG BAO GIỜ được làm hỏng phiên
        print(f"reanchor.py: {e}", file=sys.stderr)
        sys.exit(0)
