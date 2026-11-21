#!/usr/bin/env python3
"""repeat.py — đóng vòng hiện tại, mở vòng tiếp theo (pha R → pha V của vòng mới).

VÌ SAO CÓ FILE NÀY
    VIPER kết thúc ở R với quyết định go/pivot/kill. Với GO (hoặc PIVOT), Phase 2 là
    MỘT VÒNG V→I→P→E→R MỚI trên cùng repo. Tài liệu sống KHÔNG bị reset —
    insight của vòng cũ (INTERVIEW, sổ EXPERIMENTS, số liệu, challenge log) nằm nguyên
    tại chỗ. Hàng rào chống "gate vòng mới xanh sẵn nhờ vết vòng cũ" chuyển sang các
    cơ chế theo-vòng: mốc `(vòng N)` trong DECISIONS, challenge chỉ tính từ ngày
    `Vòng mở`, sổ EXPERIMENTS riêng từng vòng, gate V vòng ≥2 chỉ đọc
    `intake/loops/l<N>/` đúng số vòng, và bỏ tick các checklist "(mỗi vòng)".
    Thao tác nhiều file dễ làm sai bằng tay, nên nó là script.

ĐIỀU KIỆN (cả xem trước lẫn --go)
    Working tree sạch · vòng N chưa đóng · `gate.py R` XANH — video demo cuối vòng đã quay
    và ghi context/DEMOS.md (VIPER.md §1.5). Gate R là chỗ kiểm duy nhất: script gọi lại
    nó thay vì chép phép kiểm sang đây, để hai script không bao giờ hiểu sổ DEMOS khác nhau.

LÀM GÌ (--go)
    1. Archive vòng N    → context/archive/vong-N/ — snapshot lịch sử (PRD, INTERVIEW,
                           PROTOTYPE, DESIGN-SYSTEM, CAPABILITIES-MAP, ROADMAP,
                           sổ EXPERIMENTS của vòng, BC-CHECKLIST, STATE). Chỉ copy,
                           không xoá bản sống.
    2. Đóng intake gốc   → MOVE drop intake/*.md (đường MESH-render — chỉ vòng 1) vào
                           archive. intake/loops/ và intake/design-systems/ ở lại.
    3. STATE sửa tại chỗ → Vòng: N+1 · Vòng mở: <ngày> · Pha: V · Ngày: D1 · bỏ tick
                           §Gate. Challenge log, Blocker, phát hiện dogfood GIỮ NGUYÊN
                           — việc còn treo mang sang vòng mới, không mất.
    4. Sổ vòng mới       → tạo context/EXPERIMENTS-v<N+1>.md (scaffold nằm ngay trong
                           script này) + thư mục intake/loops/l<N+1>/. Đường phỏng vấn:
                           chờ Authority thả tài liệu vòng. Đường intake: _PROPOSAL.md
                           thường đã có sẵn từ kế hoạch lập ở vòng 1 (VIPER.md §1.4) —
                           script in ra tập pha của vòng mới để meta biết đi tới đâu.
    5. Re-arm checklist  → bỏ tick mục "(mỗi vòng)" trong PRODUCTION-READY.md + toàn bộ
                           §3 của BACKWARD-COMPATIBILITY-CHECKLIST.md (guard_bc chặn
                           deploy tới khi §3 xanh lại).
    6. Mốc DECISIONS     → "| (vòng N+1) | …" — gate chỉ đếm quyết định dưới mốc.
    Không tự commit. Chạy xong: /viper-validate. KHÔNG phỏng vấn lại.

KHÔNG LÀM GÌ
    Không quay video hộ — video là việc của meta ở pha R, trên sản phẩm thật. Không đụng
    context/DEMOS.md (sổ cộng dồn) hay demos/ (đánh số theo vòng, tự nó là lưu trữ).
    Không reset, không ghi đè, không xoá gì trong context/. INTERVIEW.md đóng băng làm
    hiện vật vòng 1. Ngày chốt PROTOTYPE giữ nguyên — tài liệu vòng trong intake/loops/
    là chữ ký của Authority cho vòng mới. PRD / PERSONAS / ARCHITECTURE / DESIGN-SYSTEM
    / TECHSTACK / DECISIONS / ROADMAP / CAPABILITIES-MAP là tài liệu sống — vòng mới
    sửa delta trong pha V.

Usage:
    python3 scripts/repeat.py         # xem trước — kiểm điều kiện, không ghi gì
    python3 scripts/repeat.py --go    # thực thi

Windows: dùng `python scripts\\repeat.py`.

Exit codes: 0 ok · 1 điều kiện chưa đạt / lỗi · 2 sai tham số
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Archive (bản của vòng vừa đóng — kể cả file sẽ giữ nguyên, để có snapshot lịch sử).
# Sổ EXPERIMENTS của vòng được thêm lúc chạy (tên phụ thuộc số vòng — xem exp_rel()).
ARCHIVE = ["context/PRD.md", "context/INTERVIEW.md", "context/PROTOTYPE.md",
           "context/DESIGN-SYSTEM.md", "context/CAPABILITIES-MAP.md",
           "context/ROADMAP.md", "context/DOGFOOD-PLAN.md", "context/SOLUTION.md",
           "context/BACKWARD-COMPATIBILITY-CHECKLIST.md", "STATE.md"]
PER_ROUND = "(mỗi vòng)"

# Scaffold sổ EXPERIMENTS cho vòng ≥2 — nằm trong script (không lấy từ commit đầu:
# commit đầu chỉ có bản vòng 1, và dự án bootstrap từ template cũ vẫn phải chạy được).
EXPERIMENTS_SCAFFOLD = """\
---
type: experiments
tier: T2
---

# EXPERIMENTS — vòng {n}

> Pha E. Sản phẩm dựng ra để **trả lời một câu hỏi**, không phải để tồn tại.
> Mỗi giả thuyết phải có cách đo và ngưỡng quyết định ghi **trước khi** nhìn số liệu
> — nếu không, đọc số nào cũng thấy mình đúng.
> Số liệu vòng trước nằm ở sổ của vòng đó (vòng 1: `EXPERIMENTS.md`,
> vòng k ≥ 2: `EXPERIMENTS-v<k>.md`) — đọc trực tiếp, không phải đào archive.
>
> **Đường intake**: pha E tuỳ chọn theo vòng — sổ này chỉ phải điền khi
> `intake/loops/l{n}/_PROPOSAL.md` khai `E` trong `Pha vòng này`. Vòng chỉ V+I thì
> để nguyên, gate E tự bỏ qua (`VIPER.md §1.4`).

---

## Giả thuyết vòng {n}

Nguồn: `PRD.md §1` + `§6` + `intake/loops/l{n}/` (`_PROPOSAL.md` + tài liệu Authority).

| # | Tin rằng | Đo bằng | Ngưỡng | Kết quả | Kết luận |
|---|---|---|---|---|---|
| H1 | _CHƯA ĐIỀN_ | | | | |

## Số liệu theo ngày

| Ngày | Truy cập | Đăng ký | Hoàn tất luồng lõi | Quay lại | Ghi chú |
|---|---|---|---|---|---|
| | | | | | |

## Phản hồi người dùng thật

Ghi nguyên văn, không tóm tắt lại theo ý mình. Câu chửi có giá trị hơn lời khen.

| Ngày | Ai | Nói gì (nguyên văn) | Rút ra |
|---|---|---|---|
| | | | |

## Thử nghiệm đã chạy

| Ngày | Thử gì | Vì sao | Kết quả | Giữ hay bỏ |
|---|---|---|---|---|
| | | | | |

---

## Quyết định cuối tuần (pha R)

```
Số liệu chốt : _CHƯA ĐIỀN_
So với ngưỡng: _CHƯA ĐIỀN_
Quyết định   : GO / PIVOT / KILL
Vì sao       : _CHƯA ĐIỀN_
Tiếp theo    : _CHƯA ĐIỀN_ (vòng sau làm gì, hoặc dừng ở đâu)
```

Quyết định này phải copy thành một dòng trong `DECISIONS.md`.
"""


def read(rel: str) -> str:
    try:
        return (ROOT / rel).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def write(rel: str, text: str) -> None:
    (ROOT / rel).write_text(text, encoding="utf-8")


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                          text=True, timeout=30)


def current_round(state: str) -> int:
    m = re.search(r"Vòng\s*:\s*(\d+)", state)
    return int(m.group(1)) if m else 1


def phase(state: str) -> str:
    m = re.search(r"Pha hiện tại\s*:\s*(V|I|P1|P2|P|E|R)\b", state)
    return m.group(1) if m else "?"


def exp_rel(n: int) -> str:
    """Sổ EXPERIMENTS của vòng n — vòng 1 giữ tên gốc, vòng ≥2 mỗi vòng một file."""
    return "context/EXPERIMENTS.md" if n <= 1 else f"context/EXPERIMENTS-v{n}.md"


def is_intake() -> bool:
    """Đường intake hay đường phỏng vấn — cùng dấu hiệu mà gate.py dùng."""
    return bool(re.search(r"^NGUỒN\s*:\s*INTAKE\b",
                          read("context/INTERVIEW.md"), re.MULTILINE))


def loop_phases(n: int) -> str:
    """Dòng `Pha vòng này:` của _PROPOSAL.md vòng n — "" nếu chưa có kế hoạch."""
    m = re.search(r"^Pha vòng này\s*:\s*(.+)$",
                  read(f"intake/loops/l{n}/_PROPOSAL.md"), re.MULTILINE)
    return m.group(1).strip() if m else ""


def open_rows(state: str, header: str) -> int:
    """Số dòng dữ liệu trong một bảng của STATE.md — để nhắc việc còn treo."""
    i = state.find(header)
    if i < 0:
        return 0
    j = state.find("\n## ", i + len(header))
    block = state[i : j if j > 0 else len(state)]
    rows = [l for l in block.splitlines()
            if l.startswith("|") and not re.match(r"^\|[\s|:-]+\|$", l)]
    return sum(1 for r in rows[1:] if r.strip("| ").strip())


def checks() -> tuple[list[str], int, str]:
    """(danh sách lỗi chặn, vòng hiện tại, pha hiện tại). Cảnh báo in thẳng."""
    errors: list[str] = []
    state = read("STATE.md")
    n, p = current_round(state), phase(state)

    if git("rev-parse", "--is-inside-work-tree").returncode != 0:
        errors.append("không phải git repo — cần git để kiểm working tree sạch "
                      "trước khi quay vòng")
        return errors, n, p

    dirty = git("status", "--porcelain").stdout.strip()
    if dirty:
        errors.append("working tree chưa sạch — commit vòng hiện tại TRƯỚC khi quay vòng\n"
                      "    (repeat sẽ sửa nhiều file; trộn với thay đổi chưa commit là mất dấu)")

    if (ROOT / "context" / "archive" / f"vong-{n}").exists():
        errors.append(f"context/archive/vong-{n}/ đã tồn tại — vòng {n} đã được đóng rồi?")

    # Video demo cuối vòng (VIPER.md §1.5): mọi vòng, kể cả vòng intake chỉ V+I — đó là
    # chỗ Authority thấy vòng đã giao gì. CHẶN chứ không cảnh báo: quay mất vài phút,
    # còn đóng vòng mà không có thì vòng sau xây chồng lên thứ chưa ai thấy chạy.
    errors.extend(demo_errors(n))

    if p != "R":
        print(f"  ⚠ pha hiện tại là {p}, không phải R — quay vòng giữa chừng "
              "là bỏ dở vòng cũ, chắc chưa?")
    for label, header in (("blocker", "## Blocker"),
                          ("phát hiện dogfood chưa xử", "## Phát hiện từ dogfood chưa xử")):
        k = open_rows(state, header)
        if k:
            print(f"  ⚠ vòng {n} còn {k} {label} đang mở — STATE.md không bị reset nên "
                  f"chúng mang sang vòng mới; xử hoặc đẩy ROADMAP.md trong pha V")

    # Vòng khai chạy pha nào thì phải thật sự chạy pha đó (VIPER.md §1.4). Cảnh báo
    # chứ không chặn: quyết định bỏ dở một pha vẫn là quyền của người, nhưng bỏ dở
    # trong im lặng thì vòng sau không biết mình đứng trên nền gì.
    phases = loop_phases(n)
    if phases:
        if "P" in phases.upper() and re.search(r"^URL production\s*:\s*\(chưa có\)",
                                               state, re.MULTILINE):
            print(f"  ⚠ vòng {n} khai chạy pha P nhưng STATE.md chưa có URL production "
                  "— deploy chưa xảy ra?")
        if "E" in phases.upper() and not re.search(
                r"^\|\s*\d{4}-\d{2}-\d{2}\s*\|", read(exp_rel(n)), re.MULTILINE):
            print(f"  ⚠ vòng {n} khai chạy pha E nhưng {exp_rel(n)} chưa có dòng số "
                  "liệu nào — quyết go/pivot/kill dựa trên gì?")
    return errors, n, p


def demo_errors(n: int) -> list[str]:
    """Chạy `gate.py R` — rỗng nếu xanh, ngược lại một lỗi kèm các dòng ✗ của gate."""
    gate = ROOT / "scripts" / "gate.py"
    try:
        g = subprocess.run([sys.executable, str(gate), "R"], cwd=ROOT, capture_output=True,
                           text=True, timeout=60, env={**os.environ, "NO_COLOR": "1"})
    except (OSError, subprocess.TimeoutExpired) as e:
        return [f"không chạy được scripts/gate.py R ({e}) — không kiểm được video demo vòng {n}"]
    if g.returncode == 0:
        return []
    fails = [l.strip()[1:].strip() for l in g.stdout.splitlines()
             if l.strip().startswith("✗") and not l.strip().startswith("✗ Gate")]
    detail = "\n".join(f"      · {f}" for f in fails) or ("      " + (g.stderr or g.stdout)[-300:])
    return [f"gate R đỏ — video demo cuối vòng {n} chưa đủ (VIPER.md §1.5, /viper-repeat Bước 2):\n"
            + detail + "\n    quay demo, ghi context/DEMOS.md, commit, rồi chạy lại"]


def roadmap_phase(n: int) -> str | None:
    """Cột Phase của dòng vòng n ở ROADMAP.md §1 (đường intake lập sẵn kế hoạch)."""
    text = re.sub(r"<!--.*?-->", "", read("context/ROADMAP.md"), flags=re.DOTALL)
    head = None
    for line in text.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if not line.strip().startswith("|"):
            head = None
            continue
        if head is None:
            head = [c.lower() for c in cells]
            continue
        if "phase" not in head or "vòng" not in head or set(cells[0]) <= set("-: "):
            continue
        num = re.sub(r"\D", "", cells[head.index("vòng")])
        if num and int(num) == n and head.index("phase") < len(cells):
            ph = cells[head.index("phase")].strip()
            return ph or None
    return None


def next_phase(state: str, n: int, forced: str | None) -> tuple[str, int, bool]:
    """(tên Phase của vòng n+1, vòng đầu của Phase đó, có phải Phase MỚI không)."""
    m = re.search(r"^Phase\s*:\s*(.+?)\s*·\s*mở ở vòng\s*(\d+)", state, re.MULTILINE)
    cur, start = (m.group(1).strip(), int(m.group(2))) if m else ("MVP", 1)
    new = forced or roadmap_phase(n + 1)
    if new and new != cur:
        return new, n + 1, True
    return cur, start, False


def do_go(n: int, forced_phase: str | None = None) -> int:
    today = date.today().isoformat()

    # 1. Archive — snapshot lịch sử, chỉ copy, không đụng bản sống.
    arch = ROOT / "context" / "archive" / f"vong-{n}"
    arch.mkdir(parents=True)
    to_archive = ARCHIVE + [exp_rel(n)]
    for rel in to_archive:
        text = read(rel)
        if text:
            (arch / Path(rel).name).write_text(text, encoding="utf-8")
    print(f"  ✓ archive vòng {n} → context/archive/vong-{n}/ "
          f"({sum(1 for r in to_archive if read(r))} file — snapshot, bản sống giữ nguyên)")

    # 2. Đóng cửa intake gốc: MOVE drop MESH-render (đường vào chỉ của vòng 1).
    # Template _*.md, design-systems/ (registry sống) và loops/ (đánh số theo vòng,
    # tự nó là lưu trữ) ở lại.
    drops = sorted(p for p in (ROOT / "intake").glob("*.md")
                   if not p.name.startswith("_") and p.name != "README.md")
    if drops:
        (arch / "intake").mkdir(exist_ok=True)
        for p in drops:
            (arch / "intake" / p.name).write_text(p.read_text(encoding="utf-8"),
                                                  encoding="utf-8")
            p.unlink()
        print(f"  ✓ intake/ → archive/vong-{n}/intake/ (MOVE {len(drops)} drop — "
              "đường MESH-render chỉ dùng vòng 1)")

    # 3. STATE sửa TẠI CHỖ — không ghi đè từ scaffold. Challenge log, Blocker,
    # phát hiện dogfood, Stack, URL đều giữ nguyên vị trí.
    state = read("STATE.md")
    if re.search(r"^Vòng\s*:", state, re.MULTILINE):
        state = re.sub(r"^Vòng\s*:.*$", f"Vòng          : {n + 1}", state,
                       count=1, flags=re.MULTILINE)
    else:  # dự án bootstrap từ template cũ chưa có dòng Vòng
        state = re.sub(r"^(Pha hiện tại\s*:.*)$", rf"\1\nVòng          : {n + 1}",
                       state, count=1, flags=re.MULTILINE)
    if re.search(r"^Vòng mở\s*:", state, re.MULTILINE):
        state = re.sub(r"^Vòng mở\s*:.*$", f"Vòng mở       : {today}", state,
                       count=1, flags=re.MULTILINE)
    else:
        state = re.sub(r"^(Vòng\s*:.*)$", rf"\1\nVòng mở       : {today}",
                       state, count=1, flags=re.MULTILINE)
    state = re.sub(r"^Pha hiện tại\s*:.*$", "Pha hiện tại : V", state,
                   count=1, flags=re.MULTILINE)
    # Phase sản phẩm (MVP, Phase 2…): vòng đầu của Phase mới phải lập lại SOLUTION phần A.
    ph_name, ph_start, ph_new = next_phase(state, n, forced_phase)
    ph_line = f"Phase         : {ph_name} · mở ở vòng {ph_start}"
    if re.search(r"^Phase\s*:", state, re.MULTILINE):
        state = re.sub(r"^Phase\s*:.*$", ph_line, state, count=1, flags=re.MULTILINE)
    else:  # dự án nâng từ bản chưa có dòng Phase
        state = re.sub(r"^(Vòng\s*:.*)$", rf"\1\n{ph_line}", state, count=1, flags=re.MULTILINE)
    state = re.sub(r"^Ngày\s*:.*$", "Ngày          : D1", state,
                   count=1, flags=re.MULTILINE)
    # Checkbox §Gate là trạng thái làm việc theo vòng — trắng lại, phần còn lại giữ.
    # CHỈ trong §Gate: checkbox ở nơi khác của STATE (nếu có) không phải trạng thái
    # theo vòng, trắng chúng là phá lời hứa "phần còn lại giữ nguyên" ở trên.
    lines = state.splitlines(keepends=True)
    inside_gate, n_gate = False, 0
    for i, line in enumerate(lines):
        if re.match(r"## Gate\b", line):
            inside_gate = True
            continue
        if inside_gate and line.startswith("## "):
            inside_gate = False
        if inside_gate and line.startswith("- [x]"):
            lines[i] = "- [ ]" + line[5:]
            n_gate += 1
    state = "".join(lines)
    write("STATE.md", state)
    print(f"  ✓ STATE.md sửa tại chỗ: vòng {n + 1}, mở {today}, pha V, ngày D1"
          + (f", bỏ tick {n_gate} mục §Gate" if n_gate else "")
          + " — challenge log / blocker / Stack / URL giữ nguyên")

    # 4a. Sổ EXPERIMENTS của vòng mới — mỗi vòng một file, sổ cũ nguyên vẹn.
    new_exp = exp_rel(n + 1)
    if read(new_exp).strip():
        print(f"  ⚠ {new_exp} đã tồn tại — giữ nguyên, không ghi đè")
    else:
        write(new_exp, EXPERIMENTS_SCAFFOLD.format(n=n + 1))
        print(f"  ✓ tạo {new_exp} — sổ đo của vòng {n + 1} (sổ vòng cũ giữ nguyên)")

    # 4b. Cửa vào pha V của vòng mới: thư mục tài liệu vòng.
    # Đường intake: kế hoạch đã lập ở vòng 1 nên _PROPOSAL.md thường nằm sẵn ở đây —
    # in tập pha ra để meta biết vòng mới đi tới đâu (V+I, hay có cả deploy/đo).
    loop_dir = ROOT / "intake" / "loops" / f"l{n + 1}"
    loop_dir.mkdir(parents=True, exist_ok=True)
    waiting = sorted(p.name for p in loop_dir.glob("*.md") if not p.name.startswith("_"))
    phases = loop_phases(n + 1)
    if phases:
        print(f"  ✓ intake/loops/l{n + 1}/_PROPOSAL.md đã có (kế hoạch từ vòng 1) — "
              f"vòng {n + 1} chạy pha: {phases}")
    elif is_intake():
        print(f"  ⚠ tạo intake/loops/l{n + 1}/ nhưng CHƯA có _PROPOSAL.md — kế hoạch "
              f"vòng dừng trước vòng {n + 1}?")
        print("    Đi tiếp thì cập nhật context/ROADMAP.md §1 rồi tạo _PROPOSAL.md "
              "từ intake/loops/_PROPOSAL-DETAIL-TEMPLATE.md")
    else:
        print(f"  ✓ tạo intake/loops/l{n + 1}/ — Authority thả tài liệu vòng vào đây "
              "(mẫu: intake/loops/_TEMPLATE.md)")
    if waiting:
        print(f"    + {len(waiting)} tài liệu của Authority đang chờ: {', '.join(waiting)}")
    # Kế hoạch dogfood KHÔNG viết hộ: vai nào bật phụ thuộc phạm vi vòng mới, chỉ biết ở
    # pha V. Bản cũ còn `Vòng: N` nên gate V vòng mới đỏ tới khi lập lại (fail-closed).
    print(f"  · context/DOGFOOD-PLAN.md vẫn là kế hoạch vòng {n} (bản sao đã vào archive) — "
          f"lập lại cho vòng {n + 1} ở pha V: chọn vai theo phạm vi mới, smoke §3 thêm AC vòng {n}")
    if ph_new:
        print(f"  ✓ vòng {n + 1} MỞ PHASE MỚI: {ph_name} — pha V lập lại context/SOLUTION.md "
              "phần A (giải pháp tổng thể của Phase) + Authority chốt, rồi phần B cho vòng này")
    else:
        print(f"  · vẫn Phase {ph_name} (mở ở vòng {ph_start}) — SOLUTION.md phần A giữ nguyên; "
              f"pha V làm giàu phần B cho vòng {n + 1} (nâng phần còn hiệu lực của B cũ lên A3/ARCHITECTURE)")

    # 5. Mốc vòng trong DECISIONS: gate chỉ đếm quyết định DƯỚI mốc cuối cùng.
    # So theo ngày là hổng — quay vòng cùng ngày thì quyết định vòng cũ vẫn được đếm.
    # Mốc phải đứng ĐẦU DÒNG: file cũ thiếu newline cuối thì mốc dính vào dòng
    # trước, regex `^|` của gate không nhận và quyết định vòng cũ đếm cho vòng mới.
    dec = read("context/DECISIONS.md")
    if dec and not dec.endswith("\n"):
        dec += "\n"
    dec += (f"| (vòng {n + 1}) | — mở vòng {n + 1} ngày {today} — "
            f"quyết định của vòng này nằm DƯỚI dòng này | | | |\n")
    write("context/DECISIONS.md", dec)
    print(f"  ✓ DECISIONS.md: ghi mốc (vòng {n + 1}) — gate chỉ đếm quyết định dưới mốc")

    # 6a. Re-arm checklist: mục "(mỗi vòng)" trong PRODUCTION-READY.
    pr = read("context/PRODUCTION-READY.md")
    pr2 = "\n".join(l.replace("- [x]", "- [ ]", 1) if PER_ROUND in l else l
                    for l in pr.splitlines())
    n_unticked = sum(1 for a, b in zip(pr.splitlines(), pr2.splitlines()) if a != b)
    if n_unticked:
        write("context/PRODUCTION-READY.md", pr2 + ("\n" if pr.endswith("\n") else ""))
        print(f"  ✓ PRODUCTION-READY.md: bỏ tick {n_unticked} mục '{PER_ROUND}' — "
              "tính năng mới phải qua kiểm lại")

    # 6b. Checklist tương thích ngược: sổ hợp đồng §1 giữ nguyên (registry sống),
    # CHỈ mục rà §3 bỏ tick — vòng mới phải rà lại; gate P1 + guard_bc bám vào đây.
    bc_rel = "context/BACKWARD-COMPATIBILITY-CHECKLIST.md"
    bc = read(bc_rel)
    if bc:
        out, inside, n_bc = [], False, 0
        for line in bc.splitlines():
            if re.match(r"## 3(?!\d)", line):  # đúng §3 — "## 30. Ghi chú" không tính
                inside = True
            elif inside and line.startswith("## "):
                inside = False
            if inside and line.startswith("- [x]"):
                line = "- [ ]" + line[5:]
                n_bc += 1
            out.append(line)
        if n_bc:
            write(bc_rel, "\n".join(out) + ("\n" if bc.endswith("\n") else ""))
            print(f"  ✓ BACKWARD-COMPATIBILITY-CHECKLIST.md: bỏ tick {n_bc} mục §3 — "
                  "vòng mới rà lại trước khi được deploy")

    if phases:
        step2 = (f"Rà lại intake/loops/l{n + 1}/_PROPOSAL.md — đối chiếu kết quả vòng {n},\n"
                 f"     chỉnh nếu lệch, rồi ghi dòng `Rà lại vòng {n + 1}: <ngày hôm nay>`.\n"
                 "     (Authority muốn đổi kế hoạch → thả thêm .md vào cùng thư mục)")
    else:
        step2 = ("Authority thả tài liệu vòng (thêm mới / thay đổi / bỏ đi) vào "
                 f"intake/loops/l{n + 1}/\n     — mẫu: intake/loops/_TEMPLATE.md. "
                 "Trả lời qua chat cũng được, meta ghi hộ (pha V).")
    print(f"""
✓ Vòng {n + 1} đã mở — không file nào bị reset, insight vòng {n} nằm nguyên tại chỗ.

  1. git add -A && git commit -m "đóng vòng {n}, mở vòng {n + 1}"
  2. {step2}
  3. /viper-validate     # đọc {'kế hoạch vòng' if phases else 'tài liệu vòng'} + kết quả vòng {n} ({exp_rel(n)}),
                         # cập nhật PRD/context, challenge, khoá scope — KHÔNG phỏng vấn
  4. Trong suốt vòng {n + 1}: smoke test của vòng {n} phải GIỮ XANH — sản phẩm đang chạy
     là ràng buộc, không phải điểm khởi đầu trống.""")
    return 0


def main(argv: list[str]) -> int:
    go = "--go" in argv
    forced = None
    rest = [a for a in argv if a != "--go"]
    if "--phase" in rest:
        i = rest.index("--phase")
        if i + 1 >= len(rest) or not rest[i + 1].strip():
            print("Usage: --phase cần tên Phase, ví dụ --phase \"Phase 2\"", file=sys.stderr)
            return 2
        forced = rest[i + 1].strip()
        del rest[i:i + 2]
    if rest:
        print(f"Usage: python3 scripts/repeat.py [--go] [--phase \"<tên Phase mới>\"]"
              f"  (tham số lạ: {' '.join(rest)})", file=sys.stderr)
        return 2

    state = read("STATE.md")
    n = current_round(state)
    print(f"=== VIPER repeat — đóng vòng {n}, mở vòng {n + 1} ==="
          + ("" if go else "  (xem trước, chưa ghi gì)"))
    errors, n, _ = checks()
    if errors:
        for e in errors:
            print(f"  ✗ {e}", file=sys.stderr)
        return 1
    if not go:
        entry_note = (f"(đã có _PROPOSAL.md: {loop_phases(n + 1)})" if loop_phases(n + 1)
                   else "(chờ tài liệu vòng của Authority)")
        print(f"""  ✓ điều kiện đủ. Sẽ làm khi chạy với --go (KHÔNG reset gì cả):
      archive snapshot → context/archive/vong-{n}/
      STATE sửa tại chỗ: vòng {n + 1} · Vòng mở · pha V · ngày D1 · bỏ tick §Gate
      tạo {exp_rel(n + 1)} + intake/loops/l{n + 1}/ {entry_note}
      mốc (vòng {n + 1}) vào DECISIONS · bỏ tick mục '{PER_ROUND}' + BC §3
      Phase vòng {n + 1}: {next_phase(state, n, forced)[0]}{" (MỞ PHASE MỚI — lập lại SOLUTION phần A)" if next_phase(state, n, forced)[2] else " (tiếp Phase hiện tại)"}
      move drop intake/*.md → archive/vong-{n}/intake/ (nếu có — đường MESH chỉ vòng 1)
      video demo vòng {n}: gate R xanh (context/DEMOS.md §Vòng {n}) — không đụng tới

  Nhớ: quyết định go/pivot/kill phải nằm ở DECISIONS.md + sổ EXPERIMENTS TRƯỚC
  khi quay vòng (gate R) — quay vòng không thay được quyết định.""")
        return 0
    return do_go(n, forced)


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except KeyboardInterrupt:
        sys.exit(130)
