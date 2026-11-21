#!/usr/bin/env python3
"""compact.py — báo cáo vệ sinh tài liệu `context/`. CHỈ ĐỌC, không ghi gì.

VÌ SAO CÓ FILE NÀY
    VIPER không reset tài liệu khi quay vòng (VIPER.md §1.2) — đó là chủ ý, vì reset
    làm mất trí nhớ giữa các vòng. Cái giá là các sổ chỉ-thêm-không-bớt cứ dài ra:
    DECISIONS.md, ba bảng của STATE.md, ROADMAP §3/§4/§5, BC-CHECKLIST §1, và mỗi
    vòng thêm một EXPERIMENTS-v<N>.md. Sau 5–7 vòng thì phần đọc được lẫn trong phần
    đã hết hiệu lực, và người ta bắt đầu không đọc nữa — lúc đó tài liệu mất tác dụng
    y như khi không có.

    Nhưng dọn tay thì NGUY HIỂM, vì nhiều dòng trông như rác lại đang là mỏ neo của
    gate. Nặng nhất: gate.py V grep CẢ FILE DECISIONS.md để tìm dòng chốt stack của
    vòng 1 — xoá dòng đó là gate V đỏ vĩnh viễn, ở mọi vòng về sau. Bẫy thứ hai:
    read_live() bỏ sạch <!-- --> trước khi đếm, nên "gấp cho gọn" bằng cách bọc
    comment làm nội dung biến mất khỏi mọi phép đếm mà nhìn file vẫn thấy nó.

    Nên công cụ này KHÔNG tự sửa. Nó chỉ nói ba điều: chỗ nào là rác gấp được, chỗ nào
    mồ côi, và — quan trọng nhất — chỗ nào TUYỆT ĐỐI không được đụng. Việc gấp là của
    người, theo /viper-compact.

VÌ SAO KHÔNG CÓ --go
    Một script tự sửa tài liệu phải đoán ý người viết ở hàng chục chỗ. Đoán sai một
    lần trên sổ append-only là mất vĩnh viễn thứ không ai nhớ để khôi phục. Đổi lại
    bằng một báo cáo đọc trong 30 giây thì rẻ hơn nhiều.

CHẠY NHƯ THẾ NÀO
    python3 scripts/compact.py            # báo cáo đầy đủ
    python3 scripts/compact.py --check    # y hệt (giữ cho quen tay, không khác gì)

    LUÔN exit 0 — đây là báo cáo, không phải gate. Nó không được quyền chặn ai.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UNFILLED = "_CHƯA ĐIỀN_"

# Ngưỡng "bắt đầu thành rác" — không phải luật, chỉ là chỗ đáng nhìn lại.
BUSY_LINES = 60

COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)


# --- đọc, cùng ngữ nghĩa gate.py -------------------------------------------
# Giữ ĐỒNG BỘ với gate.py: báo cáo mà hiểu file khác gate thì nó chỉ vào chỗ sai.

def read(rel: str) -> str:
    try:
        return (ROOT / rel).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def read_live(rel: str) -> str:
    """Nội dung đã bỏ khối <!-- --> — đúng thứ gate.py đếm."""
    return COMMENT.sub("", read(rel))


def section(rel: str, header: str) -> str:
    text = read_live(rel)
    i = text.find(header)
    if i < 0:
        return ""
    j = text.find("\n## ", i + len(header))
    return text[i: j if j > 0 else len(text)]


def current_round() -> int:
    m = re.search(r"Vòng\s*:\s*(\d+)", read("STATE.md"))
    return int(m.group(1)) if m else 1


def round_opened() -> str | None:
    m = re.search(r"^Vòng mở\s*:\s*(\d{4}-\d{2}-\d{2})", read_live("STATE.md"),
                  re.MULTILINE)
    return m.group(1) if m else None


def exp_books() -> list[Path]:
    d = ROOT / "context"
    return sorted(p for p in d.glob("EXPERIMENTS*.md") if p.is_file())


def exp_round(p: Path) -> int:
    m = re.fullmatch(r"EXPERIMENTS-v(\d+)\.md", p.name)
    return int(m.group(1)) if m else 1


# --- in ---------------------------------------------------------------------

def supports_color() -> bool:
    return sys.stdout.isatty()


C = supports_color()
BOLD = "\033[1m" if C else ""
DIM = "\033[2m" if C else ""
RED = "\033[31m" if C else ""
YEL = "\033[33m" if C else ""
OFF = "\033[0m" if C else ""


def head(text: str) -> None:
    print(f"\n{BOLD}{text}{OFF}")


def item(text: str) -> None:
    print(f"  · {text}")


def hint(text: str) -> None:
    print(f"    {DIM}{text}{OFF}")


# --- A. rác tích tụ ---------------------------------------------------------

def rows_of(text: str) -> list[str]:
    """Dòng DỮ LIỆU của các bảng markdown — bỏ tiêu đề, dòng ngăn cách, dòng rỗng.

    Dòng ngăn cách `|---|` là thứ xác định dòng ngay trên nó là tiêu đề; không lọc
    theo mốc đó thì `| Ngày | Blocker | … | Trạng thái |` bị đếm thành một blocker
    đã đóng, và báo cáo đòi gấp chính cái tiêu đề bảng.

    Dòng TRỐNG không cắt ngữ cảnh bảng. `read_live()` bỏ khối <!-- --> đi và để lại
    đúng những khoảng trắng đó giữa tiêu đề và phần append — DECISIONS.md là ví dụ
    sống. Cắt ở dòng trống thì mọi dòng ghi thêm sau đó vô hình với báo cáo.
    """
    out: list[str] = []
    seen_sep = False
    prev: str | None = None
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        if not s.startswith("|"):
            seen_sep, prev = False, None
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if cells and all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c) \
                and any(cells):
            seen_sep, prev = True, None   # dòng ngay trên là tiêu đề → bỏ luôn
            continue
        if not any(cells):
            continue
        if seen_sep:
            out.append(s)
        else:
            prev = s                       # chưa gặp ngăn cách → có thể là tiêu đề
    return out


def report_trash(rnd: int) -> int:
    """In phần A, trả số dòng gấp được."""
    head("A. RÁC TÍCH TỤ — gấp tay được")
    total = 0
    opened = round_opened()

    # DECISIONS.md — mốc `(vòng N)` là ranh giới, KHÔNG dùng ngày: repeat.py ghi đè
    # `Vòng mở` mỗi vòng nên không tra ngược được ngày mở của vòng cũ.
    dec = read_live("context/DECISIONS.md")
    cut = None
    if rnd >= 3:
        for m in re.finditer(rf"^\|\s*\(vòng {rnd - 1}\)\s*\|", dec, re.MULTILINE):
            cut = m.start()
    if cut is not None:
        above = [ln for ln in rows_of(dec[:cut])
                 if re.match(r"^\|\s*\d{4}-\d{2}-\d{2}\s*\|", ln)]
        keep = [ln for ln in above if is_pinned_decision(ln)]
        n = len(above) - len(keep)
        if n > 0:
            total += n
            item(f"context/DECISIONS.md — {n} dòng nằm TRÊN mốc `(vòng {rnd - 1})`")
            hint(f"gate vòng ≥2 chỉ đếm dòng DƯỚI mốc `(vòng {rnd})`; giữ lại "
                 f"{len(keep)} dòng neo (mục C)")
            hint("→ context/archive/ledger/DECISIONS.md")

    # STATE.md — challenge log: gate chỉ đọc dòng có ngày ≥ `Vòng mở`.
    if opened:
        ch = [ln for ln in rows_of(section("STATE.md", "\n## Challenge log"))
              if re.search(r"\d{4}-\d{2}-\d{2}", ln)]
        old = [ln for ln in ch
               if (re.search(r"\d{4}-\d{2}-\d{2}", ln).group(0) or "") < opened]
        if old:
            total += len(old)
            item(f"STATE.md §Challenge log — {len(old)}/{len(ch)} dòng cũ hơn "
                 f"`Vòng mở: {opened}`")
            hint("challenge_last() đã lọc bỏ chúng — gate không còn đọc tới")
            hint("→ context/archive/ledger/STATE-challenge.md")

    # STATE.md — blocker đã đóng, dogfood đã xử.
    for header, col, label, dest in (
        ("\n## Blocker", 3, "§Blocker dòng đã đóng", "STATE-blocker.md"),
        ("\n## Phát hiện từ dogfood chưa xử", 3, "§Phát hiện từ dogfood đã xử",
         "STATE-dogfood.md"),
    ):
        done = []
        for ln in rows_of(section("STATE.md", header)):
            cells = [c.strip() for c in ln.strip("|").split("|")]
            if len(cells) > col and cells[col] and cells[col] not in {"—", "-"}:
                done.append(ln)
        if done:
            total += len(done)
            item(f"STATE.md {label} — {len(done)} dòng")
            hint(f"→ context/archive/ledger/{dest}")

    # ROADMAP §3 backlog đã có chỗ ở kế hoạch vòng, §5 change log của vòng cũ.
    back = [ln for ln in rows_of(section("context/ROADMAP.md", "\n## 3."))
            if re.search(r"đã có ở vòng\s*(\d+)", ln)
            and int(re.search(r"đã có ở vòng\s*(\d+)", ln).group(1)) < rnd]
    if back:
        total += len(back)
        item(f"context/ROADMAP.md §3 — {len(back)} dòng backlog đã được kế hoạch vòng nuốt")
        hint("→ context/archive/ledger/ROADMAP-backlog.md")

    # Sổ EXPERIMENTS của vòng ≤ N-2 còn nằm ngoài archive.
    stale = [p for p in exp_books() if exp_round(p) <= rnd - 2]
    if stale:
        total += len(stale)
        item(f"context/ — {len(stale)} sổ EXPERIMENTS của vòng cũ: "
             + ", ".join(p.name for p in stale))
        hint("gate E chỉ đọc sổ của vòng hiện tại → context/archive/ledger/")

    # Chỉ đếm, không đề xuất gấp: mọi surface còn sống là hợp đồng.
    bc = rows_of(section("context/BACKWARD-COMPATIBILITY-CHECKLIST.md", "\n## 1."))
    if len(bc) > BUSY_LINES:
        item(f"context/BACKWARD-COMPATIBILITY-CHECKLIST.md §1 — {len(bc)} dòng "
             "(chỉ báo số, KHÔNG gấp)")
        hint("mọi surface còn sống là hợp đồng; chỉ gỡ dòng của surface đã bỏ hẳn")

    if total == 0:
        item("chưa có gì đáng gấp")
    return total


# --- B. mục mồ côi ----------------------------------------------------------

def report_orphans() -> int:
    head("B. MỤC MỒ CÔI — sửa tay")
    n = 0

    ds = "context/DESIGN-SYSTEM.md"
    proto_files = list((ROOT / "prototype").rglob("*.html")) if (ROOT / "prototype").exists() else []
    src_files = ([p for p in (ROOT / "srcroot").rglob("*")
                  if p.is_file() and p.suffix in {".css", ".scss", ".ts", ".tsx",
                                                  ".js", ".jsx", ".vue", ".svelte"}]
                 if (ROOT / "srcroot").exists() else [])
    used_text = ""
    for p in proto_files + src_files:
        try:
            used_text += p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
    tokens = re.findall(r"^\|\s*`(--[a-z0-9-]+)`\s*\|", section(ds, "\n## 2."),
                        re.MULTILINE)
    if tokens and used_text:
        dead = [t for t in tokens
                if not re.search(re.escape(t) + r"(?![A-Za-z0-9_-])", used_text)]
        if dead:
            n += len(dead)
            item(f"DESIGN-SYSTEM §2 — {len(dead)} token không dùng ở cả prototype/ lẫn "
                 f"srcroot/: {', '.join(dead[:10])}" + (" …" if len(dead) > 10 else ""))
            hint("gate V chỉ soi prototype; token chết ở code thì không ai báo")

    proto_live = read_live("context/PROTOTYPE.md")
    ghost = sorted({s for cell in re.findall(r"^\|\s*C\d+\s*\|[^|]*\|([^|]*)\|",
                                             section(ds, "\n## 4."), re.MULTILINE)
                    for s in re.findall(r"S\d+", cell)
                    if not re.search(rf"\b{s}\b", proto_live)})
    if ghost:
        n += len(ghost)
        item(f"DESIGN-SYSTEM §4 — component trỏ màn không còn ở PROTOTYPE §1: "
             f"{', '.join(ghost)}")

    # Gói design system không experience nào dùng.
    pkgs = [p.parent.name for p in sorted(
        (ROOT / "intake" / "design-systems").glob("*/tokens.json"))
        if not p.parent.name.startswith(("_", "{{"))] \
        if (ROOT / "intake" / "design-systems").exists() else []
    arch = section("context/ARCHITECTURE.md", "\n## 2.") + \
        section("context/ARCHITECTURE.md", "\n## 3.")
    idle = [d for d in pkgs if not re.search(rf"\|\s*{re.escape(d)}\s*\|", arch)]
    if len(pkgs) > 1 and idle:
        n += len(idle)
        item(f"intake/design-systems/ — gói không experience nào dùng: {', '.join(idle)}")
        hint("ánh xạ ở ARCHITECTURE §2–§3 cột `Design system`")

    prd_ac = set(re.findall(r"^\|\s*(AC-\d+)\s*\|", read_live("context/PRD.md"),
                            re.MULTILINE))
    road_ac = set(re.findall(r"^\|\s*(AC-\d+)\s*\|",
                             section("context/ROADMAP.md", "\n## 2."), re.MULTILINE))
    for label, diff in (("ROADMAP §2 có nhưng PRD §3 không", road_ac - prd_ac),
                        ("PRD §3 có nhưng ROADMAP §2 không", prd_ac - road_ac)):
        if diff:
            n += len(diff)
            item(f"{label}: {', '.join(sorted(diff))}")

    cap = section("context/CAPABILITIES-MAP.md", "\n## 1.")
    if "| CAP-" in cap:
        never = [ln.strip("|").split("|")[0].strip()
                 for ln in rows_of(cap)
                 if ln.lstrip("| ").startswith("CAP-") and "AC-" not in ln]
        if never:
            n += len(never)
            item(f"CAPABILITIES-MAP §1 — {len(never)} capability chưa vòng nào nhận: "
                 + ", ".join(never[:10]) + (" …" if len(never) > 10 else ""))

    persona_names = re.findall(r"^###\s*Persona\s*\d+\s*—\s*(.+?)\s*\(role:",
                               read_live("context/PERSONAS.md"), re.MULTILINE)
    matrix = section("context/PERSONAS.md", "\n## 2.")
    for name in persona_names:
        if name != UNFILLED and name not in matrix and matrix.strip():
            n += 1
            item(f"PERSONAS — persona “{name}” không có mặt trong ma trận §2")

    left = []
    for p in sorted((ROOT / "context").rglob("*.md")):
        t = p.read_text(encoding="utf-8", errors="replace")
        rel = p.relative_to(ROOT).as_posix()
        if "archive/" in rel:
            continue
        if UNFILLED in t:
            left.append(f"{rel} ({t.count(UNFILLED)}× {UNFILLED})")
        if re.search(r"\{\{[A-Za-z_-]+\}\}", COMMENT.sub("", t)):
            left.append(f"{rel} (còn placeholder {{{{…}}}})")
    if left:
        n += len(left)
        item("còn dấu chưa điền: " + " · ".join(left[:8])
             + (" …" if len(left) > 8 else ""))

    broken = []
    for p in sorted((ROOT / "context").rglob("*.md")):
        rel = p.relative_to(ROOT).as_posix()
        if "archive/" in rel:
            continue
        t = p.read_text(encoding="utf-8", errors="replace")
        for target in re.findall(r"\]\(([^)#\s]+)", t):
            if target.startswith(("http", "mailto:")):
                continue
            if not (p.parent / target).exists():
                broken.append(f"{rel} → {target}")
    if broken:
        n += len(broken)
        item(f"{len(broken)} link trỏ file không tồn tại: " + " · ".join(broken[:6])
             + (" …" if len(broken) > 6 else ""))

    if n == 0:
        item("không thấy mục mồ côi")
    return n


# --- C. dòng neo ------------------------------------------------------------

STACK_RE = re.compile(r"^\|\s*\d{4}-\d{2}-\d{2}\s*\|[^|\n]*?\b(?:tech)?stack\b",
                      re.MULTILINE | re.IGNORECASE)


def is_pinned_decision(line: str) -> bool:
    """Dòng DECISIONS.md không bao giờ được gấp — cùng regex gate.py V dùng."""
    return bool(STACK_RE.match(line)) or "(vòng" in line or "(template)" in line


def report_pinned() -> None:
    head(f"C. DÒNG NEO — {RED}KHÔNG ĐƯỢC GẤP{OFF}{BOLD}{OFF}")
    dec = read("context/DECISIONS.md").splitlines()
    for i, line in enumerate(dec, 1):
        if STACK_RE.match(line):
            item(f"context/DECISIONS.md:{i} — dòng chốt stack")
            hint("gate.py V grep CẢ FILE tìm dòng này ở MỌI vòng; xoá là đỏ vĩnh viễn")
    marks = [i for i, line in enumerate(dec, 1)
             if re.match(r"^\|\s*\(vòng \d+\)\s*\|", line)]
    if marks:
        item(f"context/DECISIONS.md — mốc `(vòng N)` ở dòng "
             + ", ".join(map(str, marks)))
        hint("gate đếm quyết định của vòng bằng vị trí mốc này")
    for i, line in enumerate(dec, 1):
        if re.match(r"^\|\s*\(template\)\s*\|", line):
            item(f"context/DECISIONS.md:{i} — dòng seed `(template)`")
            hint("cố ý không có ngày ISO để gate không đếm nó là quyết định thật")

    if re.search(r"^NGUỒN\s*:\s*INTAKE\b", read_live("context/INTERVIEW.md"),
                 re.MULTILINE):
        item("context/INTERVIEW.md — marker `NGUỒN: INTAKE`")
        hint("công tắc chế độ của CẢ dự án; mất nó là rơi về luật đường phỏng vấn")

    item("STATE.md — dòng `Vòng`, `Vòng mở`, `Pha hiện tại` trong khối đầu file")
    hint("mọi phép đếm theo vòng đều bắt đầu từ ba dòng này")

    item("Tiêu đề đang là mỏ neo regex — đừng đổi chữ, đừng đổi số:")
    for h in ("STATE.md: ## Gate · ## Blocker · ## Phát hiện từ dogfood chưa xử",
              "ROADMAP.md: ## 1. Kế hoạch vòng",
              "PRODUCTION-READY.md: ## Nhóm 1..4",
              "BACKWARD-COMPATIBILITY-CHECKLIST.md: ## 3",
              "DESIGN-SYSTEM.md: ## 2. · ## 3. · ## 4.",
              "ARCHITECTURE.md: ## 2. · ## 3. (cột `Design system`)",
              "PRD.md: ## 5. · ## 6.",
              "EXPERIMENTS*.md: ## Số liệu theo ngày"):
        hint(h)

    print()
    print(f"{YEL}  KHÔNG gấp bằng cách bọc <!-- -->.{OFF} `read_live()` bỏ sạch comment "
          "trước khi đếm,")
    hint("nên nội dung bọc comment BIẾN MẤT khỏi mọi phép đếm của gate trong khi nhìn "
         "file vẫn thấy nó — kiểu hỏng khó tìm nhất.")


def main(argv: list[str]) -> int:
    rnd = current_round()
    opened = round_opened()
    print(f"{BOLD}Vệ sinh tài liệu — vòng {rnd}"
          + (f" (mở {opened})" if opened else "") + f"{OFF}")
    print(f"{DIM}Báo cáo chỉ đọc. Không file nào bị sửa. Cách gấp: /viper-compact{OFF}")

    n_trash = report_trash(rnd)
    n_orphan = report_orphans()
    report_pinned()

    print()
    if rnd < 3:
        print(f"{DIM}Vòng {rnd} — tài liệu chưa kịp tích rác; báo cáo này đáng chạy "
              f"từ vòng 3 trở đi.{OFF}")
    print(f"{BOLD}Tổng: {n_trash} dòng gấp được · {n_orphan} mục mồ côi{OFF}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as e:  # báo cáo KHÔNG BAO GIỜ được làm hỏng phiên
        print(f"compact.py: {e}", file=sys.stderr)
        sys.exit(0)
