#!/usr/bin/env python3
"""gate.py — kiểm điều kiện rời pha. In ✓/✗ từng mục, exit 1 nếu còn thiếu.

KHÔNG chặn tool, không sửa gì. Chỉ báo. Quyết định đi tiếp hay không vẫn là của người.

Usage:
    python3 scripts/gate.py V|I|P1|P2|E|R  # kiểm gate của một pha
    python3 scripts/gate.py                # tự đọc pha hiện tại từ STATE.md
    make gate P=I

Pha P có HAI gate vì vài mục production-ready chỉ làm được sau khi đã deploy:
    P1  điều kiện vào /viper-publish   P2  điều kiện rời pha P sang E
Nguồn chuẩn của mọi gate: VIPER.md §1. Lệch nhau thì VIPER.md thắng.

HAI CHẾ ĐỘ (VIPER.md §1.3/§1.4). Gate rẽ nhánh theo `is_intake()`:

    ĐƯỜNG PHỎNG VẤN  Founder/PO có ý tưởng, test thị trường trong một tuần.
                     Một app · 2–3 persona · 3–7 AC · MỘT prototype/index.html ·
                     mọi vòng chạy trọn V-I-P-E-R.
    ĐƯỜNG INTAKE     Tài liệu MESH-render đã phân tích kỹ, hệ thống có thể lớn và
                     được chia thành nhiều vòng. Đa target srcroot/<nhóm>/<tên>/ · persona
                     và AC không trần (đổi lại: AC phải truy được về CAPABILITIES-MAP)
                     · prototype/**/*.html · mỗi vòng khai tập pha mình chạy trong
                     intake/loops/l<N>/_PROPOSAL.md, chỉ V + I bắt buộc mọi vòng.

Áp luật của đường phỏng vấn lên đường intake là lỗi — trần AC/persona và "một app"
sinh ra cho bối cảnh một tuần, không phải cho hệ thống chia vòng.

Windows: dùng `python scripts\\gate.py` nếu không có lệnh `python3`.

Exit codes: 0 = qua · 1 = còn thiếu · 2 = sai tham số
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UNFILLED = "_CHƯA ĐIỀN_"


# --- màu, tắt khi không phải terminal (Windows cmd, CI, pipe) ---------------

def _supports_color() -> bool:
    import os

    if os.environ.get("NO_COLOR"):
        return False
    if not sys.stdout.isatty():
        return False
    if sys.platform == "win32":
        try:  # bật VT mode trên Windows 10+
            import ctypes

            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            return False
    return True


_COLOR = _supports_color()
GREEN = "\033[32m" if _COLOR else ""
RED = "\033[31m" if _COLOR else ""
GREY = "\033[90m" if _COLOR else ""
RESET = "\033[0m" if _COLOR else ""


class Report:
    def __init__(self) -> None:
        self.passed = 0
        self.failed = 0

    def ok(self, msg: str) -> None:
        print(f"  {GREEN}✓{RESET} {msg}")
        self.passed += 1

    def no(self, msg: str) -> None:
        print(f"  {RED}✗{RESET} {msg}")
        self.failed += 1

    def note(self, msg: str) -> None:
        print(f"    {GREY}{msg}{RESET}")


# --- tiện ích ---------------------------------------------------------------

def read(rel: str) -> str:
    p = ROOT / rel
    try:
        return p.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def filled(rel: str) -> bool:
    """File tồn tại, không rỗng, và không còn dấu _CHƯA ĐIỀN_."""
    text = read(rel)
    return bool(text.strip()) and UNFILLED not in text


COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)


def read_live(rel: str) -> str:
    """Nội dung thật, đã bỏ khối <!-- -->.

    Template để dòng MẪU trong comment cho người điền dễ bắt chước. Không bỏ chúng
    ra thì mọi phép đếm đều tính cả ví dụ, và gate xanh khi chưa ai viết gì.
    """
    return COMMENT.sub("", read(rel))


def count_rows(rel: str, pattern: str) -> int:
    return len(re.findall(pattern, read_live(rel), re.MULTILINE))


def section(rel: str, header: str) -> str:
    """Nội dung một section: từ header tới `## ` cùng cấp kế tiếp (giữ lại các `###` con)."""
    text = read_live(rel)
    i = text.find(header)
    if i < 0:
        return ""
    j = text.find("\n## ", i + len(header))
    return text[i : j if j > 0 else len(text)]


def count_rows_in(rel: str, header: str, pattern: str) -> int:
    """Đếm dòng khớp pattern nhưng CHỈ trong một section (từ header tới `## ` kế tiếp).

    Sinh ra cho gate E: EXPERIMENTS.md có nhiều bảng cùng mở đầu bằng ngày ISO
    (số liệu, phản hồi, thử nghiệm) — đếm cả file thì một dòng phản hồi cũng làm
    xanh mục "số liệu thật".
    """
    return len(re.findall(pattern, section(rel, header), re.MULTILINE))


def challenge_last(phase_letter: str) -> str | None:
    """Phán quyết challenge gần nhất của MỘT pha trong STATE.md §Challenge log.

    Bảng có cột Pha: | Ngày | Pha | Câu hỏi | Phán quyết | Ghi chú |
    Lọc theo pha là bắt buộc — không lọc thì challenge V PASS sẽ cho gate I
    qua nhầm dù pha I chưa challenge lần nào.

    Vòng ≥2 (STATE.md có dòng `Vòng mở: <ISO>` do repeat.py chèn): chỉ tính
    dòng có ngày ≥ ngày mở vòng. STATE không còn bị reset khi quay vòng, nên đây là
    hàng rào chặn challenge PASS của vòng cũ xanh hộ vòng mới; dòng không có ngày
    ISO cũng không được tính (fail-closed). Vòng 1 không có `Vòng mở` → tính hết;
    vòng ≥2 mà THIẾU `Vòng mở` (bump số vòng bằng tay, script gãy giữa chừng) →
    không tính dòng nào — fail-closed, vì không có mốc thời gian thì mọi dòng log
    đều có thể là của vòng cũ.

    Giới hạn biết trước: ô "Câu hỏi" chứa ký tự `|` thì dòng đó không được nhận
    (fail-closed — gate đỏ, người xem sẽ soi). Cố tình không nới regex để nuốt
    `|`, vì nới là mở đường cho fail-open khi ô Ghi chú chứa chữ PASS.
    """
    live = read_live("STATE.md")
    rows = re.findall(
        rf"^\|([^|]*)\|\s*{phase_letter}\s*\|[^|]*\|\s*(PASS|FAIL)\s*\|",
        live, re.MULTILINE | re.IGNORECASE,
    )
    opened = re.search(r"^Vòng mở\s*:\s*(\d{4}-\d{2}-\d{2})", live, re.MULTILINE)
    if opened:
        cutoff = opened.group(1)
        def fresh(cell: str) -> bool:
            m = re.search(r"\d{4}-\d{2}-\d{2}", cell)
            return bool(m) and m.group(0) >= cutoff
        rows = [(c, v) for c, v in rows if fresh(c)]
    elif current_round() >= 2:
        rows = []  # vòng ≥2 thiếu `Vòng mở` → fail-closed (xem docstring)
    return rows[-1][1].upper() if rows else None


AFTER_DEPLOY = "(sau deploy)"


def count_unchecked(group: str, before_deploy_only: bool = False) -> int:
    """Đếm mục `- [ ]` chưa tick trong một nhóm của PRODUCTION-READY.md.

    Quét theo cờ trạng thái: vào nhóm khi gặp tiêu đề, ra khi gặp tiêu đề `## ` kế tiếp.

    before_deploy_only=True thì bỏ qua mục gắn `(sau deploy)` — những mục chỉ làm được
    khi đã có production thật (backup, HTTPS, push-là-deploy, analytics đang đếm).
    Đó là gate P1; gate P2 đếm tất cả.
    """
    inside = False
    n = 0
    for line in read("context/PRODUCTION-READY.md").splitlines():
        if line.startswith(f"## {group}"):
            inside = True
            continue
        if inside and line.startswith("## "):
            break
        if inside and line.startswith("- [ ]"):
            if before_deploy_only and AFTER_DEPLOY in line:
                continue
            n += 1
    return n


def has_cmd(target: str) -> bool:
    """Target trong Makefile đã được hiện thực (không còn NOT_IMPLEMENTED)."""
    lines = read("Makefile").splitlines()
    for i, line in enumerate(lines):
        if line.startswith(f"{target}:"):
            body = "\n".join(lines[i + 1 : i + 3])
            return "NOT_IMPLEMENTED" not in body
    return False


def commit_count() -> int:
    if not (ROOT / ".git").exists():
        return 0
    try:
        out = subprocess.run(
            ["git", "rev-list", "--count", "HEAD"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return int(out.stdout.strip() or 0)
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0


def phase_from_state() -> str | None:
    # Nhận cả P1/P2: gate pha P được đặt tên P1/P2 khắp tài liệu nên agent hay ghi
    # thẳng vào STATE.md. P1|P2 phải đứng TRƯỚC P trong alternation, không thì "P1"
    # chỉ khớp được "P" và \b hỏng (P và 1 đều là ký tự chữ-số, không có ranh giới).
    m = re.search(r"Pha hiện tại\s*:\s*(V|I|P1|P2|P|E|R)\b", read("STATE.md"))
    return m.group(1) if m else None


# --- chế độ + kế hoạch vòng ---------------------------------------------------

ALL_PHASES = frozenset("VIPER")


def is_intake() -> bool:
    """Dự án đang đi ĐƯỜNG INTAKE hay ĐƯỜNG PHỎNG VẤN.

    Một cơ chế duy nhất cho mọi rẽ nhánh: marker `NGUỒN: INTAKE` ở INTERVIEW.md
    (ngoài khối <!-- -->). Cùng dấu hiệu mà /viper-implement dùng, và nó sống sót
    qua mọi vòng vì INTERVIEW đóng băng làm hiện vật vòng 1 (VIPER.md §1.3).
    Cố tình KHÔNG dò bằng sự tồn tại của intake/PRD.md: drop gốc bị repeat.py move
    vào archive cuối vòng 1, dò kiểu đó thì vòng 2 tự rơi về đường phỏng vấn.
    """
    return bool(re.search(r"^NGUỒN\s*:\s*INTAKE\b",
                          read_live("context/INTERVIEW.md"), re.MULTILINE))


def proposal_rel(rnd: int) -> str:
    return f"intake/loops/l{rnd}/_PROPOSAL.md"


def proposal_live(rnd: int) -> str:
    return read_live(proposal_rel(rnd))


def loop_phases(rnd: int) -> frozenset[str]:
    """Tập pha vòng này chạy — đọc dòng `Pha vòng này:` trong _PROPOSAL.md.

    Chỉ đường intake mới cắt pha (VIPER.md §1.4): hệ thống lớn chia vòng thì phần
    lớn vòng chỉ V+I, deploy/đo/quyết dồn vào vòng Authority chốt. Đường phỏng vấn
    và mọi dự án chưa có _PROPOSAL.md → đủ 5 pha (tương thích ngược với dự án cũ).
    V và I luôn được thêm vào: chúng bắt buộc ở MỌI vòng, khai thiếu cũng không bỏ
    được — fail-closed đúng chỗ quan trọng nhất.
    """
    if not is_intake():
        return ALL_PHASES
    m = re.search(r"^Pha vòng này\s*:\s*(.+)$", proposal_live(rnd), re.MULTILINE)
    if not m:
        return ALL_PHASES
    declared = {c for c in m.group(1).upper() if c in ALL_PHASES}
    return frozenset(declared | {"V", "I"})


def loop_has_ui(rnd: int) -> bool:
    """Vòng này có đẻ màn hình mới không — dòng `UI vòng này:` trong _PROPOSAL.md.

    Mặc định CÓ: thiếu khai báo thì gate vẫn đòi prototype, không cho im lặng trốn.
    """
    m = re.search(r"^UI vòng này\s*:\s*(.+)$", proposal_live(rnd), re.MULTILINE)
    return not (m and re.search(r"không\s+có\s+màn\s+mới", m.group(1), re.IGNORECASE))


def skip_phase(r: Report, letter: str, name: str) -> bool:
    """In lý do bỏ qua và trả True khi vòng hiện tại không chạy pha này."""
    rnd = current_round()
    if letter in loop_phases(rnd):
        return False
    print(f"\nGate {letter} — {name}\n")
    r.ok(f"vòng {rnd} không chạy pha {letter} theo {proposal_rel(rnd)} "
         f"(`Pha vòng này`) — bỏ qua")
    r.note("kế hoạch vòng ở context/ROADMAP.md §1; đổi ý thì sửa cả hai chỗ")
    return True


def prototype_files() -> dict[str, str]:
    """Nội dung prototype TÁCH THEO EXPERIENCE — {tên experience: html}.

    Đường phỏng vấn: một khoá rỗng ứng với `prototype/index.html`.
    Đường intake: `prototype/<tên>/…` gom theo `<tên>`; file HTML nằm thẳng dưới
    `prototype/` (không có thư mục experience) cũng vào khoá rỗng.

    Tách ra thay vì nối làm một là điều kiện để canh NHIỀU design system: hệ có hai
    gói thì "token này có được dùng không" phải hỏi trong phạm vi experience của nó,
    nối chung lại thì màu của gói A dùng ở experience của gói B cũng tính là hợp lệ.
    """
    if not is_intake():
        return {"": read("prototype/index.html")}
    out: dict[str, list[str]] = {}
    base = ROOT / "prototype"
    for p in sorted(base.rglob("*.html")):
        rel = p.relative_to(base).as_posix()
        exp = rel.split("/")[0] if "/" in rel else ""
        out.setdefault(exp, []).append(p.read_text(encoding="utf-8", errors="replace"))
    return {k: "\n".join(v) for k, v in out.items()}


def prototype_html() -> str:
    """Toàn bộ prototype nối làm một — dùng cho phép kiểm "đã dựng chưa".

    Phép kiểm design system KHÔNG dùng hàm này (xem prototype_files()).
    """
    return "\n".join(prototype_files().values())


# --- design system (gate V, chỉ khi có UI) ----------------------------------

DS = "context/DESIGN-SYSTEM.md"

# Ngưỡng WCAG AA theo cột "Loại" của DESIGN-SYSTEM.md §3.
CONTRAST_LIMITS = {"thường": 4.5, "lớn": 3.0, "thành phần": 3.0}


def table_cells(text: str) -> list[tuple[list[str], list[str]]]:
    """Mọi dòng dữ liệu của mọi bảng markdown trong text → (ô tiêu đề, ô dữ liệu).

    Sinh ra để đọc cột theo TÊN chứ không theo VỊ TRÍ: bảng §2 của DESIGN-SYSTEM.md và
    bảng experience của ARCHITECTURE.md đều được nối thêm cột `DS` ở cuối để đỡ nhiều
    design system, mà đếm theo vị trí thì thêm một cột là lệch hết. Dòng ngăn cách
    `|---|` xác định "dòng ngay trên là tiêu đề" — đúng cú pháp bảng markdown.
    Giữ ĐỒNG BỘ với table_cells() trong guard_ds.py.
    """
    out: list[tuple[list[str], list[str]]] = []
    header: list[str] | None = None
    prev: list[str] | None = None
    for line in text.splitlines():
        s = line.strip()
        if not s.startswith("|"):
            header, prev = None, None
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if cells and all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
            header, prev = prev, None
            continue
        if header is None:
            prev = cells
            continue
        out.append((header, cells))
    return out


def cell_of(header: list[str], cells: list[str], *names: str) -> str:
    """Ô thuộc cột mang một trong các tên `names`. Bảng không có cột đó → chuỗi rỗng."""
    low = [h.strip().lower() for h in header]
    for n in names:
        if n in low:
            i = low.index(n)
            return cells[i].strip() if i < len(cells) else ""
    return ""


def ds_token_rows(text: str) -> list[tuple[str, str, str]]:
    """(ds, token, giá trị) cho mỗi dòng token trong một đoạn markdown.

    Tiêu chuẩn nhận dòng giữ y như trước khi có multi-design-system: ô 1 là `--tên`
    viết thường trong dấu huyền, ô 2 là giá trị. Điểm mới duy nhất là đọc thêm ô cột
    `DS`, nhờ đó hai gói cùng khai `color.primary` thành HAI dòng riêng thay vì dòng
    sau đè dòng trước — chỗ mà bản cũ nuốt mất một gói mà gate vẫn xanh.
    Không có cột DS → ds rỗng; nơi gọi quy nó về gói duy nhất (sole_ds()).

    Cố tình DỄ TÍNH hơn table_cells(): dòng token không có tiêu đề phía trên vẫn được
    nhận (ds rỗng). guard_ds.py soi từng mảnh nội dung sắp ghi, mảnh đó thường chỉ là
    một dòng bảng rời — đòi đủ tiêu đề + dòng ngăn cách là hook mù trước mọi lệnh Edit.
    Giữ ĐỒNG BỘ với ds_token_rows() trong guard_ds.py.
    """
    out: list[tuple[str, str, str]] = []
    header: list[str] = []
    prev: list[str] | None = None
    for line in text.splitlines():
        s = line.strip()
        if not s.startswith("|"):
            header, prev = [], None
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if cells and all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
            header, prev = (prev or []), None
            continue
        m = re.fullmatch(r"`(--[a-z0-9-]+)`", cells[0]) if cells else None
        if m and len(cells) >= 2:
            out.append((cell_of(header, cells, "ds", "design system").strip("`"),
                        m.group(1), cells[1]))
        else:
            prev = cells
    return out


def experience_rows() -> list[tuple[str, str]]:
    """(tên experience, tên gói design system) từ bảng §2 web + §3 mobile của ARCHITECTURE.

    Ô design system để trống hoặc `—` → chuỗi rỗng; nơi gọi tự quyết đó là chuyện
    bình thường (một design system) hay là lỗi (nhiều gói mà chưa khai experience nào
    dùng gói nào). Giữ ĐỒNG BỘ với experience_rows() trong guard_ds.py.
    """
    out: list[tuple[str, str]] = []
    arch = "context/ARCHITECTURE.md"
    for header, cells in table_cells(section(arch, "\n## 2.") + "\n\n"
                                     + section(arch, "\n## 3.")):
        exp = cells[0].strip().strip("`") if cells else ""
        ds = cell_of(header, cells, "design system", "ds").strip("`")
        if not exp or exp in {"—", "-"} or UNFILLED in exp:
            continue
        out.append((exp, "" if ds in {"—", "-"} or UNFILLED in ds else ds))
    return out


def ds_map() -> dict[str, str]:
    """experience → tên gói design system, từ cột `Design system` của ARCHITECTURE §2–§3.

    Tên experience là khoá join có sẵn của cả hệ: nó vừa là thư mục code
    `srcroot/<nhóm>/<tên>/`, vừa là thư mục prototype `prototype/<tên>/`. Cột này là
    nguồn DUY NHẤT của ánh xạ — DESIGN-SYSTEM.md §0 chỉ trỏ sang đây chứ không chép
    lại, vì hai bảng song song thì sớm muộn cũng lệch nhau mà không ai hay.
    Bảng chưa có cột (đường phỏng vấn, một design system) → {}, mọi phép kiểm chạy
    trên cả bảng token đúng như trước. Giữ ĐỒNG BỘ với ds_map() trong guard_ds.py.
    """
    return {exp: ds for exp, ds in experience_rows() if ds}


def intake_packages() -> list[Path]:
    """Gói design system thật trong intake/design-systems/ — bỏ `_*` và `{{…}}` của template."""
    return [p for p in sorted((ROOT / "intake" / "design-systems").glob("*/tokens.json"))
            if not p.parent.name.startswith(("_", "{{"))]


def sole_ds() -> str | None:
    """Tên gói khi dự án chỉ có ĐÚNG MỘT design system, ngược lại None.

    Đây là cái bản lề giữ tương thích ngược: một gói thì §2 không cần cột `DS`, dòng
    token nào cũng ngầm thuộc gói đó, và mọi phép đối chiếu chạy y hệt bản trước.
    """
    pkgs = intake_packages()
    return pkgs[0].parent.name if len(pkgs) == 1 else None


def multi_ds() -> bool:
    """Dự án đang mang NHIỀU design system — theo số gói intake, hoặc theo cột DS ở §2."""
    return (len(intake_packages()) > 1
            or len({ds for ds, _, _ in ds_token_rows(section(DS, "\n## 2.")) if ds}) > 1)


def tokens_for(tokens: dict[tuple[str, str], str], ds: str | None) -> dict[str, str]:
    """Lát token của một design system → {token: giá trị}.

    ds rỗng/None (đường phỏng vấn, hoặc experience chưa khai gói) → cả bảng, giữ
    nguyên hành vi cũ. Dòng token chưa điền ô DS luôn được tính vào mọi lát: gate báo
    riêng lỗi "chưa khai thuộc gói nào", không nên phạt nó thêm lần thứ hai ở đây.
    """
    if not ds:
        return {t: v for (_d, t), v in tokens.items()}
    return {t: v for (d, t), v in tokens.items() if d in ("", ds)}


def intake_tokens() -> tuple[dict[tuple[str, str], set[str]], str | None, list[str]]:
    """Token do Authority đưa sẵn trong intake/design-systems/<ds>/tokens.json.

    Trả ({(ds, --tên): {giá trị hợp lệ}}, nhãn đường dẫn, gói hỏng) — ({}, None, [])
    khi không có gói. Đặc tả: intake/design-systems/{{ds-name}}/_TOKENS-TEMPLATE.json.

    Đọc được ba dạng hay gặp: Design Token Format (`{"$value": …}`), khoá `value`
    thuần, và chuỗi trần (`{"radius": "8px"}`). Khoá bắt đầu bằng `$` hoặc `_` là
    metadata ($type, $description, $comment, $breakpoints) — bỏ qua, nếu không thì
    mỗi dòng chú thích trong gói lại thành một token ma.

    KHOÁ THEO GÓI, KHÔNG HỢP NHẤT. Bản trước gộp mọi gói vào một từ điển phẳng nên
    hai gói cùng khai `color.primary` khác giá trị thì §2 chỉ cần một dòng khớp MỘT
    trong hai là qua sạch cả ba phép kiểm (bịa/bỏ rơi/lệch) — gói còn lại biến mất
    khỏi nguồn sự thật mà gate vẫn in "dịch trung thành". Khoá (ds, token) làm mỗi
    gói được đối chiếu riêng, nên lỗi đó chết.
    Gói hỏng không parse được → trả kèm nhãn để check_ds_fidelity báo đỏ.

    Có gói này nghĩa là hình thức ĐÃ ĐƯỢC QUYẾT ở ngoài — pha V chỉ dịch, không chọn
    lại (VIPER.md §1.3: intake là hợp đồng). Gate dùng nó để bắt ba lỗi mà mắt hay
    bỏ qua: bịa token mới, bỏ rơi token của gói, và đổi giá trị token đã có.
    Giữ ĐỒNG BỘ với intake_tokens() trong guard_ds.py.
    """
    import json

    real = intake_packages()
    if not real:
        return {}, None, []

    flat: dict[tuple[str, str], set[str]] = {}
    broken: list[str] = []

    def walk(node: object, trail: list[str], ds: str) -> None:
        if isinstance(node, dict):
            for key in ("$value", "value"):
                if key in node and not isinstance(node[key], (dict, list)):
                    flat.setdefault((ds, "--" + "-".join(trail)), set()).add(
                        str(node[key]).strip())
                    return
            for k, v in node.items():
                if str(k).startswith(("$", "_")):
                    continue
                walk(v, trail + [str(k).strip().lower().replace(" ", "-")], ds)
        elif isinstance(node, (str, int, float)) and trail:
            flat.setdefault((ds, "--" + "-".join(trail)), set()).add(str(node).strip())

    for path in real:
        try:
            walk(json.loads(path.read_text(encoding="utf-8")), [], path.parent.name)
        except (OSError, ValueError):
            # Báo đích danh gói hỏng — nuốt âm thầm thì token của gói này bị gate
            # gán nhãn "bịa"/"bỏ rơi" lạc hướng, người sửa đi xoá token thay vì sửa gói.
            broken.append(str(path.relative_to(ROOT)))
    return flat, ", ".join(str(p.relative_to(ROOT)) for p in real), broken


def check_ds_fidelity(r: Report, tokens: dict[tuple[str, str], str]) -> None:
    """DESIGN-SYSTEM.md phải TRUNG THÀNH với gói token của intake — ĐỐI CHIẾU TỪNG GÓI.

    Ba lỗi bị chặn — cùng bộ mà hook scripts/guard_ds.py chặn lúc ghi file:
      · BỊA    — token có trong DESIGN-SYSTEM.md mà gói intake không có;
      · LƯỜI   — token gói intake có mà DESIGN-SYSTEM.md bỏ rơi;
      · LỆCH   — cùng tên nhưng giá trị khác gói intake.
    Không có gói intake (đường phỏng vấn, hoặc intake không kèm design system) →
    không kiểm: lúc đó token do chính pha V quyết, không có bản gốc để đối chiếu.

    Nhiều gói thì mỗi gói một lượt đối chiếu riêng. Gộp chung lại là chỗ bản trước
    thủng: hai gói cùng khai `color.primary` khác giá trị mà §2 chỉ có một dòng thì
    cả ba phép kiểm đều qua, gói thứ hai mất hút mà gate vẫn xanh.
    """
    src, path, broken = intake_tokens()
    if path is None:
        return
    for b in broken:
        r.no(f"{b} không đọc được (JSON hỏng) — không đối chiếu được gói này")
        r.note("gói design system của intake là hợp đồng; hỏng thì báo Authority thả lại")
    if not src:
        if not broken:
            r.no(f"{path} không có token nào — gói rỗng, không đối chiếu được")
        return

    # Nhiều gói mà dòng token không khai thuộc gói nào → đối chiếu kiểu gì cũng sai
    # địa chỉ. Báo đúng một lỗi rồi dừng, đừng đổ thêm "bịa"/"bỏ rơi" chồng lên.
    if len({ds for ds, _ in src}) > 1:
        orphan = sorted({t for ds, t in tokens if not ds})
        if orphan:
            r.no(f"token ở §2 chưa khai thuộc design system nào: {', '.join(orphan)}")
            r.note("dự án có nhiều gói design system → bảng §2 phải có cột `DS` ghi tên "
                   "thư mục gói (intake/design-systems/<ds>/) cho TỪNG dòng token")
            return

    def norm(v: str) -> str:
        v = v.strip().strip("`").lower()
        m = re.fullmatch(r"#([0-9a-f]{3})", v)
        return "#" + "".join(c * 2 for c in m.group(1)) if m else v

    invented: list[str] = []
    dropped: list[str] = []
    drifted: list[str] = []
    packages = sorted({ds for ds, _ in src})
    for ds in packages:
        mine = {t: v for (d, t), v in tokens.items() if d == ds}
        theirs = {t: vals for (d, t), vals in src.items() if d == ds}
        tag = f" [{ds}]" if len(packages) > 1 else ""
        invented += sorted(f"{t}{tag}" for t in mine if t not in theirs)
        dropped += sorted(f"{t}{tag}" for t in theirs if t not in mine)
        drifted += sorted(
            f"{t}{tag}: {mine[t].strip()} ≠ {' | '.join(sorted(theirs[t]))}"
            for t in mine
            if t in theirs and norm(mine[t]) not in {norm(v) for v in theirs[t]})

    if invented:
        r.no(f"token bịa thêm, không có trong {path}: {', '.join(invented)}")
        r.note("intake là hợp đồng — cần token mới thì hỏi Authority ở pha V rồi ghi "
               "1 dòng DECISIONS.md, không tự thêm")
    if dropped:
        r.no(f"token của {path} bị bỏ rơi: {', '.join(dropped)}")
        r.note("dịch đủ gói, không cắt cho nhanh — bảng §2 là bản dịch đầy đủ của gói")
    if drifted:
        r.no(f"token lệch giá trị so với {path}: {' · '.join(drifted)}")
        r.note("sửa lại đúng giá trị gốc; muốn đổi thật thì Authority chốt + DECISIONS.md")
    if not invented and not dropped and not drifted:
        r.ok(f"token khớp đúng {len(src)} mục của {path} — dịch trung thành"
             + (f" ({len(packages)} gói, đối chiếu riêng từng gói)"
                if len(packages) > 1 else ""))


def _hex_rgb(value: str) -> tuple[int, int, int] | None:
    m = re.fullmatch(r"`?#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})`?", value.strip())
    if not m:
        return None
    h = m.group(1)
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _contrast(rgb1: tuple, rgb2: tuple) -> float:
    """Tỉ lệ tương phản WCAG — đủ dùng ngay trong stdlib, khỏi cần công cụ ngoài."""
    def lum(rgb: tuple) -> float:
        def lin(c: int) -> float:
            s = c / 255
            return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4
        r, g, b = (lin(c) for c in rgb)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    hi, lo = sorted((lum(rgb1), lum(rgb2)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def check_design_system(r: Report, proto_live: str) -> None:
    """Ba phép kiểm máy làm được mà mắt người hay cho qua:

    1. token khai ở §2 phải được prototype DÙNG thật — bảng token không phải trang trí;
    2. tương phản §3 tính từ mã hex — chữ xám nhạt trên nền trắng chết ngoài nắng;
    3. component §4 phải có màn hình (PROTOTYPE §1) dùng nó — không nuôi component tưởng tượng.

    Cặp/ô không tính được (Loại lạ, giá trị không phải hex) → ĐỎ chứ không bỏ qua,
    cùng triết lý fail-closed với challenge_last().
    """
    if filled(DS):
        r.ok("context/DESIGN-SYSTEM.md đã điền")
    else:
        r.no("context/DESIGN-SYSTEM.md chưa điền xong")
        r.note("token + tương phản + kho component — điền TRƯỚC khi dựng prototype")
        return  # chưa điền thì các phép kiểm dưới toàn nhiễu

    # §2 — token: dòng | `--tên` | giá trị | … | DS |. Khoá (ds, token): một gói thì
    # ô DS để trống cũng được, sole_ds() quy nó về gói duy nhất — dự án cũ không phải
    # sửa một chữ nào. Nhiều gói thì ô DS là bắt buộc (check_ds_fidelity báo đỏ).
    sole = sole_ds()
    tokens: dict[tuple[str, str], str] = {}
    for ds_cell, tok, val in ds_token_rows(section(DS, "\n## 2.")):
        tokens[(ds_cell or sole or "", tok)] = val
    if not tokens:
        r.no("DESIGN-SYSTEM.md §2 chưa khai token nào (dòng | `--tên` | giá trị |)")
        return

    # Có gói design system từ intake → bảng §2 phải là bản dịch trung thành của nó.
    check_ds_fidelity(r, tokens)

    # Nhiều gói thì phải biết experience nào mặc gói nào, không thì mọi phép kiểm
    # dưới đây chỉ còn là phép hợp nhất — đúng chỗ bản trước để lọt việc trộn DS.
    mapping = ds_map()
    if len(intake_packages()) > 1:
        rows = experience_rows()
        blank = [e for e, d in rows if not d]
        if not rows:
            r.no("ARCHITECTURE.md §2–§3 chưa khai experience nào — có nhiều gói design "
                 "system thì phải biết gói nào dùng cho experience nào")
        elif blank:
            r.no(f"experience chưa khai design system: {', '.join(blank)}")
            r.note("thêm cột `Design system` ở ARCHITECTURE.md §2–§3, giá trị là tên thư "
                   "mục gói (intake/design-systems/<ds>/) — đây là nguồn ánh xạ DUY NHẤT")
        else:
            r.ok(f"{len(rows)} experience đều khai design system (ARCHITECTURE §2–§3)")

    files = prototype_files()
    built = {k: v for k, v in sorted(files.items()) if v.strip()}
    if built:
        all_html = "\n".join(built.values())
        # Chưa map được experience nào thì prototype của nó tính cho MỌI gói — thà
        # rộng còn hơn báo oan; phép kiểm ánh xạ ở trên đã đỏ đúng chỗ rồi.
        loose = "\n".join(h for e, h in built.items() if not mapping.get(e))
        by_ds: dict[str, str] = {}
        for exp, html in built.items():
            d = mapping.get(exp)
            if d:
                by_ds[d] = by_ds.get(d, "") + "\n" + html

        # 1. Token khai ra thì phải DÙNG. Phạm vi là GÓI chứ không phải từng file:
        #    hai experience chung một gói thì token dùng ở một bên là đã dùng.
        unused: list[str] = []
        idle_ds: list[str] = []
        for (d, t) in sorted(tokens):
            # Token chưa gán gói (ô DS trống, một-design-system, hoặc đường phỏng vấn)
            # thì soi trên TOÀN BỘ prototype — nó không thuộc riêng gói nào để mà thu hẹp.
            hay = (all_html if not mapping or not d
                   else by_ds.get(d, "") + "\n" + loose)
            if not hay.strip():
                if d not in idle_ds:
                    idle_ds.append(d)
                continue
            if not re.search(re.escape(t) + r"(?![A-Za-z0-9_-])", hay):
                # Lookahead chặn khớp tiền tố: prototype chỉ dùng --color-text-muted
                # không được tính là đã dùng --color-text.
                unused.append(f"{t} [{d}]" if d and len(by_ds) > 1 else t)
        if unused:
            r.no(f"token khai nhưng prototype không dùng: {', '.join(unused)}")
            r.note("dùng qua var(--…) hoặc xoá dòng token thừa — bảng §2 là danh sách đóng")
        else:
            r.ok(f"prototype dùng đủ {len(tokens)} token của DESIGN-SYSTEM.md §2")
        if idle_ds:
            r.note(f"gói chưa experience nào dựng prototype: {', '.join(sorted(idle_ds))} "
                   "— chưa tới vòng của nó thì bình thường, ngược lại là gói chết")

        # 2–4. Ba phép kiểm còn lại soi TỪNG FILE, đối chiếu đúng lát token của
        #      experience đó — token của gói khác dùng ở đây là TRỘN DESIGN SYSTEM.
        for exp, html in built.items():
            d = mapping.get(exp)
            slice_ = tokens_for(tokens, d)
            where = f" ({exp})" if exp else ""

            # Prototype không được xài token chưa khai ở §2 — chỗ "tự bịa" hay lọt:
            # thêm một màu cho vừa mắt bằng cách khai biến mới thẳng trong :root.
            # Nhận cả tên viết HOA/underscore: CSS custom property phân biệt hoa
            # thường, regex chỉ [a-z] thì --EVIL đứng ngoài mọi phép kiểm — một
            # design system thứ hai toàn tên hoa mà không ai thấy.
            used = set(re.findall(r"var\(\s*(--[A-Za-z0-9_-]+)", html))
            used |= set(re.findall(r"^\s*(--[A-Za-z0-9_-]+)\s*:", html, re.MULTILINE))
            undeclared = sorted(t for t in used if t not in slice_)
            if undeclared:
                # Token có thật nhưng thuộc gói khác → gọi đúng tên bệnh.
                foreign = sorted({f"{t} (của {od})" for t in undeclared
                                  for (od, ot) in tokens if ot == t and od != d})
                if foreign:
                    r.no(f"prototype{where} dùng token của design system khác: "
                         f"{', '.join(foreign)}")
                    r.note(f"experience này mặc gói `{d}` (ARCHITECTURE §2–§3) — trộn hai "
                           "gói là phá hợp đồng hình thức của cả hai")
                rest = [t for t in undeclared if not any(ot == t for (_o, ot) in tokens)]
                if rest:
                    r.no(f"prototype{where} dùng token chưa khai ở §2: {', '.join(rest)}")
                    r.note("khai vào bảng §2 trước rồi mới dùng — nguồn sự thật của hình "
                           "thức là DESIGN-SYSTEM.md, không phải file HTML")

            # Màu thô ngoài :root — BACKSTOP của hook guard_ds: hook chỉ chặn lỗi MỚI
            # lúc ghi và fail-open khi DS chưa chốt, nên vết lọt một lần mà gate không
            # báo là mất dấu vĩnh viễn. Cùng regex/phạm vi với guard_ds.py.
            html_body = re.sub(r"/\*.*?\*/", "",
                               re.sub(r"<!--.*?-->", "", html, flags=re.DOTALL),
                               flags=re.DOTALL)
            outside_root = re.sub(r":root\s*\{[^}]*\}", ":root{}", html_body,
                                  flags=re.IGNORECASE)
            raw_colors = sorted({m.group(0).rstrip("(").strip().lower()
                                 for m in re.finditer(
                                     r"#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(",
                                     outside_root)})
            if raw_colors:
                r.no(f"prototype{where} có mã màu thô ngoài :root: "
                     f"{', '.join(raw_colors[:8])}" + (" …" if len(raw_colors) > 8 else ""))
                r.note("màu luôn thuộc về token — quy về var(--…) của bảng §2; "
                       ":root là chỗ duy nhất được ghi giá trị thật")

            # Giá trị token trong :root phải KHỚP §2 — :root là nơi token thành pixel,
            # sửa một dòng ở đó là vô hiệu design system mà bảng §2 không hay biết.
            # Chỉ so khi cả hai là hex (dạng khác nhiều cách viết tương đương, so thô đỏ oan).
            root_vals = dict(re.findall(
                r"(--[A-Za-z0-9_-]+)\s*:\s*([^;}]+)",
                "".join(re.findall(r":root\s*\{([^}]*)\}", html_body, re.IGNORECASE))))
            root_drift = sorted(
                f"{t}: :root={v.strip()} ≠ §2 {slice_[t].strip()}"
                for t, v in root_vals.items()
                if _hex_rgb(slice_.get(t, "")) and _hex_rgb(v)
                and _hex_rgb(slice_[t]) != _hex_rgb(v))
            if root_drift:
                r.no(f"token trong :root prototype{where} lệch giá trị §2: "
                     f"{' · '.join(root_drift)}")
                r.note("§2 là nguồn sự thật — đổi token thì sửa cả hai nơi trong cùng lượt")

        # Lười biếng: khai 12 màn ở PROTOTYPE §1 rồi chỉ dựng 4. Màn thuộc experience
        # nào cũng được, miễn có dựng — nên phép này soi toàn bộ prototype.
        screens = sorted(set(re.findall(r"\bS\d+\b", section("context/PROTOTYPE.md",
                                                            "\n## 1."))),
                         key=lambda s: int(s[1:]))
        unbuilt = [s for s in screens if not re.search(rf"\b{s}\b", all_html)]
        if screens and unbuilt:
            r.no(f"màn khai ở PROTOTYPE.md §1 nhưng prototype chưa dựng: "
                 f"{', '.join(unbuilt)}")
            r.note("dựng đủ hoặc xoá khỏi bản đồ màn hình — prototype nửa vời thì "
                   "Authority chốt trên thứ không tồn tại")
        elif screens:
            r.ok(f"prototype dựng đủ {len(screens)} màn khai ở PROTOTYPE.md §1")
    # prototype chưa có thì mục prototype ở trên đã đỏ — không báo trùng ở đây

    # §3 — tương phản: | mô tả | `--fg` | `--bg` | loại | … | DS |
    pairs: list[tuple[str, str, str, str]] = []
    for header, cells in table_cells(section(DS, "\n## 3.")):
        if len(cells) < 4:
            continue
        mf = re.fullmatch(r"`(--[a-z0-9-]+)`", cells[1])
        mb = re.fullmatch(r"`(--[a-z0-9-]+)`", cells[2])
        if mf and mb:
            pairs.append((cell_of(header, cells, "ds", "design system").strip("`"),
                          mf.group(1), mb.group(1), cells[3]))
    if not pairs:
        r.no("DESIGN-SYSTEM.md §3 chưa có cặp tương phản nào để kiểm")
    else:
        bad, unchecked = [], []
        for pair_ds, fg, bg, kind in pairs:
            slice_ = tokens_for(tokens, pair_ds or sole)
            tag = f" [{pair_ds}]" if pair_ds else ""
            limit = CONTRAST_LIMITS.get(kind.strip().lower())
            c_fg, c_bg = _hex_rgb(slice_.get(fg, "")), _hex_rgb(slice_.get(bg, ""))
            if limit is None or c_fg is None or c_bg is None:
                unchecked.append(f"{fg}/{bg}{tag}")
                continue
            ratio = _contrast(c_fg, c_bg)
            if ratio < limit:
                bad.append(f"{fg} trên {bg}{tag} = {ratio:.1f}:1 (cần ≥ {limit}:1)")
        if bad:
            r.no(f"tương phản chưa đạt AA: {' · '.join(bad)}")
            r.note("đậm chữ lên hoặc nhạt nền đi trong §2.1 — sửa token, không sửa bảng §3")
        if unchecked:
            r.no(f"cặp tương phản không tính được: {', '.join(unchecked)}")
            r.note("ô Loại phải là thường/lớn/thành phần; token phải có ở §2.1 (đúng gói "
                   "của cặp đó), giá trị là mã hex")
        if not bad and not unchecked:
            r.ok(f"tương phản đạt WCAG AA cả {len(pairs)} cặp trong §3")

    # §4 — component: | C1 | tên | dùng ở màn | trạng thái | … | DS |
    comps: list[tuple[str, str, str]] = []
    for header, cells in table_cells(section(DS, "\n## 4.")):
        if len(cells) >= 3 and re.fullmatch(r"C\d+", cells[0]):
            comps.append((cells[0], cells[2],
                          cell_of(header, cells, "ds", "design system").strip("`")))
    if not comps:
        r.no("DESIGN-SYSTEM.md §4 chưa có component nào (dòng | C1 | … |)")
        return
    orphan = [cid for cid, cell, _ in comps if not re.search(r"S\d+", cell)]
    ghost = sorted({s for _, cell, _ in comps for s in re.findall(r"S\d+", cell)
                    if not re.search(rf"\b{s}\b", proto_live)})
    if orphan:
        r.no(f"component chưa ghi màn hình nào dùng nó: {', '.join(orphan)}")
        r.note("ô 'Dùng ở màn' trỏ mã màn PROTOTYPE §1 (S1, S2…) — không màn nào dùng thì xoá")
    if ghost:
        r.no(f"component trỏ tới màn không có trong PROTOTYPE.md §1: {', '.join(ghost)}")
    if not orphan and not ghost:
        r.ok(f"kho component: {len(comps)} khối, khối nào cũng có màn hình dùng")

    # Component của gói A bị màn của experience mặc gói B nhận — CẢNH BÁO, không đỏ:
    # màn nào thuộc experience nào chỉ suy được từ file prototype nào có chứa mã màn,
    # suy đoán thì không đủ chắc để chặn người ta lại.
    if mapping and built:
        screen_ds = {s: mapping.get(exp, "")
                     for exp, html in built.items()
                     for s in re.findall(r"\bS\d+\b", html)}
        crossed = sorted({f"{cid} ({cds}) ở màn {s} ({screen_ds[s]})"
                          for cid, cell, cds in comps if cds
                          for s in re.findall(r"S\d+", cell)
                          if screen_ds.get(s) and screen_ds[s] != cds})
        if crossed:
            r.note(f"component dùng ở màn thuộc design system khác: {', '.join(crossed)}")


def cap_ac_cells() -> str | None:
    """Ghép các ô thuộc cột "AC vòng này" của CAPABILITIES-MAP.md §1.

    Trả None khi bảng không có cột đó. Tìm cả file thì AC ghi ở cột Trạng thái
    ("AC-5 dời vòng 3") hay ở ghi chú cũng được tính là truy vết được — hàng rào
    thay cho trần 7 AC (VIPER.md §1.1) yếu đi đúng chỗ nó phải chặt.
    """
    idx = None
    cells: list[str] = []
    for line in read_live("context/CAPABILITIES-MAP.md").splitlines():
        if not line.strip().startswith("|"):
            if idx is not None and line.startswith("## "):
                break  # hết bảng năng lực — không ăn sang bảng khác (Change log…)
            continue
        cols = [c.strip() for c in line.strip().strip("|").split("|")]
        if idx is None:
            for i, c in enumerate(cols):
                # So BẰNG, không so chứa: ô dữ liệu "AC-3 dời vòng, xem AC vòng này"
                # mà được nhận làm header là bắt nhầm bảng.
                if c == "AC vòng này":
                    idx = i
                    break
            continue
        if idx < len(cols):
            cells.append(cols[idx])
    return "\n".join(cells) if idx is not None else None


# --- kế hoạch vòng của đường intake (gate V) --------------------------------

PROPOSAL_TEMPLATE = "intake/loops/_PROPOSAL-DETAIL-TEMPLATE.md"

# Tiêu đề các mục bắt buộc của _PROPOSAL.md (cột ✓ của mẫu). Khớp theo CHỮ, bỏ qua số
# thứ tự — đánh số lại không làm gate đỏ, xoá mục thì có. "Màn hình" chỉ bắt khi vòng
# khai có màn mới; "Phi chức năng" là mục "khi có" nên không nằm đây.
PROPOSAL_SECTIONS = (
    "Mục tiêu vòng", "Kịch bản demo cuối vòng", "Cỡ vòng", "Phạm vi", "Ngoài phạm vi",
    "AC chi tiết", "Luồng người dùng", "Màn hình", "Thay đổi theo target",
    "Contract delta", "Dữ liệu & migration", "Luật nghiệp vụ", "Ca biên",
    "Quyền & bảo mật", "Phụ thuộc ngoài", "Quyết định & câu hỏi mở", "Kế hoạch test",
    "Gợi ý dogfood", "Rủi ro", "Thứ tự triển khai", "Định nghĩa xong",
    "Phụ thuộc vòng trước", "Legacy được phép phá", "Điều chỉnh khi mở vòng",
)


def proposal_heading(live: str, title: str) -> re.Match | None:
    """Tiêu đề `## [số.] <title>` — đúng cấp 2, neo đầu tiêu đề: "Phạm vi" không khớp
    nhầm "Ngoài phạm vi", "### 7.1" không tính là một mục."""
    return re.search(rf"^##\s+(?:\d+\.\s*)?{re.escape(title)}", live,
                     re.MULTILINE | re.IGNORECASE)


def check_proposal_body(r: Report, rnd: int, live: str) -> None:
    """Proposal phải đủ chi tiết để pha V DỊCH chứ không ĐOÁN (mẫu chi tiết, VIPER.md §1.4).

    Bản cũ chỉ có mục tiêu + capability + legacy — đủ lập kế hoạch, không đủ làm: pha V
    phải tự suy AC, màn, giải pháp, và pha R không có kịch bản để quay video demo. Mục
    không áp dụng thì ghi `—` + lý do; xoá tiêu đề là gate thấy ngay. §2 Kịch bản demo
    phải có bước thật vì video demo cuối vòng (gate R) quay theo đúng các bước đó.
    """
    rel = proposal_rel(rnd)
    wanted = [s for s in PROPOSAL_SECTIONS if s != "Màn hình" or loop_has_ui(rnd)]
    missing = [s for s in wanted if not proposal_heading(live, s)]
    if missing:
        r.no(f"{rel} thiếu {len(missing)} mục của mẫu kế hoạch vòng: {', '.join(missing)}")
        r.note(f"mẫu {PROPOSAL_TEMPLATE} — mục không áp dụng ghi `—` + lý do, "
               "không xoá tiêu đề; vòng xa thì hẹn `— chi tiết hoá khi rà lại vòng N`")
    else:
        r.ok(f"{rel}: đủ {len(wanted)} mục bắt buộc của mẫu kế hoạch vòng")
    m = proposal_heading(live, "Kịch bản demo cuối vòng")
    if m:
        j = live.find("\n## ", m.end())
        steps = re.findall(r"^\|\s*\d+\s*\|\s*[^|\s]", live[m.end(): j if j > 0 else len(live)],
                           re.MULTILINE)
        if steps:
            r.ok(f"{rel} §2: kịch bản demo {len(steps)} bước — smoke của vòng + kịch bản video pha R")
        else:
            r.no(f"{rel} §2 Kịch bản demo cuối vòng chưa có bước nào")
            r.note("bảng Bước · Người dùng làm · Thấy gì · AC — video demo cuối vòng "
                   "(gate R) quay theo đúng các bước này")


def check_proposal(r: Report, rnd: int) -> None:
    """Kiểm _PROPOSAL.md của vòng hiện tại — cửa vào pha V của đường intake vòng ≥2.

    Kế hoạch vòng được lập MỘT LẦN ở vòng 1 từ intake ROADMAP + capability map, nên
    Authority không phải ký lại mỗi vòng (VIPER.md §1.4). Nhưng "đã lập sẵn" cũng có
    nghĩa mọi vòng sẽ xanh sẵn ngay từ vòng 1 nếu gate chỉ kiểm file có tồn tại —
    vì vậy đòi thêm dòng `Rà lại vòng N: <ISO>` có ngày ≥ `Vòng mở`: meta phải thực
    sự đọc lại kế hoạch, đối chiếu kết quả vòng trước, rồi mới ghi. Cùng cơ chế đếm
    theo vòng với challenge_last() và mốc (vòng N) của DECISIONS.
    """
    rel = proposal_rel(rnd)
    raw = read(rel)
    if not raw.strip():
        r.no(f"vòng {rnd}: chưa có {rel} — kế hoạch vòng thiếu")
        r.note("kế hoạch lập ở vòng 1 (/viper-validate mục I5). Vòng ngoài kế hoạch "
               "thì cập nhật context/ROADMAP.md §1 rồi tạo file này từ "
               f"{PROPOSAL_TEMPLATE}")
        return
    if re.search(r"\{\{.+?\}\}", raw):
        r.no(f"{rel} còn placeholder {{{{…}}}} — chưa phải kế hoạch thật")
        r.note("bản copy _PROPOSAL-DETAIL-TEMPLATE.md chưa điền không tính")
        return

    live = read_live(rel)
    check_proposal_body(r, rnd, live)
    phases = loop_phases(rnd)
    if re.search(r"^Pha vòng này\s*:", live, re.MULTILINE):
        r.ok(f"{rel}: vòng {rnd} chạy pha {', '.join(sorted(phases, key='VIPER'.index))}")
    else:
        r.no(f"{rel} thiếu dòng `Pha vòng này:` — không biết vòng này chạy tới đâu")
        r.note("V và I bắt buộc mọi vòng; thêm P/E/R ở vòng Authority chốt deploy/đo/quyết")

    # Dòng rà lại: phải đúng số vòng và không cũ hơn ngày mở vòng. Vòng ≥2 mà STATE
    # thiếu `Vòng mở` (không mở bằng repeat.py) → fail-closed: không có mốc để đối
    # chiếu thì ngày rà lại nào cũng "hợp lệ", tức kế hoạch lập sẵn xanh mọi vòng.
    m = re.search(rf"^Rà lại vòng {rnd}\s*:\s*(\d{{4}}-\d{{2}}-\d{{2}})",
                  live, re.MULTILINE)
    if not m:
        r.no(f"{rel} chưa có dòng `Rà lại vòng {rnd}: <ngày ISO>`")
        r.note("đọc kế hoạch vòng + số liệu/kết quả vòng trước, chỉnh nếu lệch, "
               "rồi ghi ngày hôm nay — đây là dấu vết cho thấy vòng này đã được rà thật")
        return
    opened = re.search(r"^Vòng mở\s*:\s*(\d{4}-\d{2}-\d{2})",
                       read_live("STATE.md"), re.MULTILINE)
    if opened is None:
        r.no(f"vòng {rnd} mà STATE.md không có dòng `Vòng mở: <ISO>` — "
             f"không đối chiếu được ngày `Rà lại vòng {rnd}`")
        r.note("mở vòng bằng `python3 scripts/repeat.py --go` (script chèn dòng này); "
               "thiếu thì bổ sung đúng ngày mở vòng rồi chạy lại gate")
    elif m.group(1) < opened.group(1):
        r.no(f"{rel}: `Rà lại vòng {rnd}` ghi ngày {m.group(1)}, cũ hơn "
             f"`Vòng mở: {opened.group(1)}` — dấu vết của lần rà trước")
        r.note("rà lại sau khi mở vòng rồi ghi ngày hôm nay")
    else:
        r.ok(f"kế hoạch vòng {rnd} đã được rà lại ngày {m.group(1)}")


def check_loop_plan(r: Report) -> None:
    """Vòng 1 đường intake: kế hoạch chia vòng phải có và phải khớp với thư mục.

    Đường intake nhận cả một hệ thống, không phải một MVP — việc đầu tiên ở pha V là
    cắt nó thành mấy vòng và mỗi vòng làm gì (VIPER.md §1.4). Bảng ở ROADMAP.md §1 là
    bản sống; _PROPOSAL.md từng vòng là chi tiết. Lệch nhau nghĩa là kế hoạch mới nằm
    trong đầu chứ chưa nằm trên đĩa — vòng sau mở ra sẽ không có gì để đọc.
    """
    rows = count_rows_in("context/ROADMAP.md", "## 1. Kế hoạch vòng",
                         r"^\|\s*(?:vòng\s*)?\d+\s*\|")
    if rows < 1:
        r.no("context/ROADMAP.md §1 chưa có dòng kế hoạch vòng nào")
        r.note("đường intake phải chia hệ thống thành N vòng ở pha V — "
               "xem /viper-validate mục I5")
        return

    have = sorted(int(p.parent.name[1:])
                  for p in (ROOT / "intake" / "loops").glob("l*/_PROPOSAL.md")
                  if p.parent.name[1:].isdigit() and read(
                      f"intake/loops/{p.parent.name}/_PROPOSAL.md").strip())
    missing = [n for n in range(1, rows + 1) if n not in have]
    if missing:
        r.no(f"kế hoạch có {rows} vòng nhưng thiếu _PROPOSAL.md của vòng: "
             f"{', '.join(f'l{n}' for n in missing)}")
        r.note("mỗi dòng ở ROADMAP §1 phải có intake/loops/l<N>/_PROPOSAL.md tương ứng")
    else:
        r.ok(f"kế hoạch vòng: {rows} vòng, vòng nào cũng có _PROPOSAL.md")


# --- bộ giải pháp: phần A của Phase · phần B của vòng (gate V) ----------------

SOL = "context/SOLUTION.md"


def state_phase() -> tuple[str, int] | None:
    """Dòng `Phase : <tên> · mở ở vòng <N>` của STATE.md → (tên, vòng đầu của Phase)."""
    m = re.search(r"^Phase\s*:\s*(.+?)\s*·\s*mở ở vòng\s*(\d+)", read_live("STATE.md"),
                  re.MULTILINE)
    return (m.group(1).strip(), int(m.group(2))) if m else None


def check_solution(r: Report, rnd: int) -> None:
    """Gate V: bộ giải pháp mà pha I phải tuân thủ.

    Phần A (giải pháp tổng thể của Phase) lập ở vòng đầu của Phase và Authority chốt —
    đây là chỗ giải pháp lớn, khó đảo ngược được nhìn thấy TRƯỚC khi agent làm, thay
    vì một dòng DECISIONS đọc sau. Phần B làm giàu cho đúng AC của vòng — thiếu nó thì
    "tự quyết khi code" (luật #2) thành đoán.
    """
    ph = state_phase()
    if ph is None:
        r.no("STATE.md thiếu dòng `Phase : <tên> · mở ở vòng <N>` — Phase sản phẩm đang chạy")
        r.note("ví dụ `Phase         : MVP · mở ở vòng 1`; mở Phase mới bằng repeat.py --phase")
        return
    name, start = ph
    live = read_live(SOL)
    if not live.strip():
        r.no(f"{SOL} chưa có — bộ giải pháp của Phase {name}")
        return
    errs: list[str] = []
    m_ph = re.search(r"^Phase\s*:\s*(.+)$", live, re.MULTILINE)
    m_st = re.search(r"^Vòng đầu của Phase\s*:\s*(\d+)", live, re.MULTILINE)
    if not m_ph or m_ph.group(1).strip() != name or not m_st or int(m_st.group(1)) != start:
        errs.append(f"phần A không phải của Phase {name} (mở ở vòng {start}) — "
                    "vòng đầu của Phase phải lập lại giải pháp tổng thể")
    part_a = section(SOL, "## A.")
    miss = [f"A{i}" for i in range(1, 6) if f"### A{i}." not in part_a]
    if miss:
        errs.append("phần A thiếu mục " + ", ".join(miss))
    if UNFILLED in part_a:
        errs.append("phần A còn ô _CHƯA ĐIỀN_")
    if not re.search(r"^\|\s*G-\d+\s*\|\s*[^|\s]", part_a, re.MULTILINE):
        errs.append("A3 chưa có quy ước bắt buộc nào (G-…) — pha I không có gì để tuân thủ")
    m_ok = re.search(r"^Authority chốt Phase\s*:\s*(\d{4}-\d{2}-\d{2})", live, re.MULTILINE)
    cutoff = round_cutoff()
    if not m_ok:
        errs.append("phần A chưa có `Authority chốt Phase: <ngày ISO>`")
    elif rnd == start and rnd >= 2 and (cutoff is None or m_ok.group(1) < cutoff):
        errs.append(f"vòng {rnd} là vòng đầu của Phase {name} mà ngày Authority chốt "
                    "cũ hơn `Vòng mở` — chốt của Phase trước không gánh hộ Phase mới")

    part_b = section(SOL, "## B.")
    m_v = re.search(r"^Vòng\s*:\s*(\d+)", part_b, re.MULTILINE)
    if not m_v or int(m_v.group(1)) != rnd:
        errs.append(f"phần B là giải pháp của vòng {m_v.group(1) if m_v else '?'} — "
                    f"chưa làm giàu cho vòng {rnd}")
    else:
        if UNFILLED in part_b:
            errs.append("phần B còn ô _CHƯA ĐIỀN_")
        acs = re.findall(r"^\|\s*(AC-\d+)\s*\|\s*[^|\s]", read_live("context/PRD.md"),
                         re.MULTILINE)
        b1 = set(re.findall(r"^\|\s*(AC-\d+)\s*\|\s*[^|\s]",
                            section(SOL, "### B1."), re.MULTILINE))
        lack = [a for a in acs if a not in b1]
        if lack:
            errs.append("B1 thiếu giải pháp cho " + ", ".join(lack))

    if errs:
        for e in errs:
            r.no(f"SOLUTION: {e}")
        r.note("phần A lập ở vòng đầu Phase + Authority chốt; phần B viết lại mỗi vòng "
               "— /viper-validate Bước 5b")
    else:
        n_g = len(re.findall(r"^\|\s*G-\d+", part_a, re.MULTILINE))
        r.ok(f"SOLUTION: Phase {name} đã chốt · {n_g} quy ước · phần B vòng {rnd} phủ mọi AC")


# --- kế hoạch dogfood (gate V lập · gate I/P2 đối chiếu kết quả) -------------

PLAN = "context/DOGFOOD-PLAN.md"
ROLES_DIR = ROOT / ".claude/skills/viper-roles/roles"
ALWAYS_ON = "smoke"                      # smoke hồi quy: luôn bật, mọi dự án, mọi vòng
NO_UI_OFF = ("picky", "mobile", "a11y")  # vai chỉ có nghĩa khi có giao diện


def roster() -> list[str]:
    """Danh mục vai = tên thẻ ở .claude/skills/viper-roles/roles/ — thêm thẻ là thêm vai."""
    return sorted(p.stem for p in ROLES_DIR.glob("*.md"))


def _role(cell: str) -> str:
    return cell.strip().strip("`").strip()


def plan_choice() -> dict[str, tuple[str, str]]:
    """§1 Chọn vai → {vai: (bật|tắt|…, căn cứ)}."""
    out: dict[str, tuple[str, str]] = {}
    for h, c in table_cells(section(PLAN, "## 1.")):
        v = _role(c[0]) if c else ""
        if v:
            out[v] = (cell_of(h, c, "bật").strip().lower(), cell_of(h, c, "căn cứ"))
    return out


def plan_round() -> int | None:
    m = re.search(r"^Vòng\s*:\s*(\d+)", read_live(PLAN), re.MULTILINE)
    return int(m.group(1)) if m else None


def has_mobile_experience() -> bool:
    """ARCHITECTURE §3 có ít nhất một experience mobile thật (không phải `—`)."""
    for _, c in table_cells(section("context/ARCHITECTURE.md", "\n## 3.")):
        exp = c[0].strip().strip("`") if c else ""
        if exp and exp not in {"—", "-"} and UNFILLED not in exp:
            return True
    return False


def check_dogfood_plan(r: Report, rnd: int, no_ui: bool) -> None:
    """Gate V: kế hoạch dogfood của ĐÚNG vòng này — chọn vai có căn cứ, smoke luôn bật.

    Không vai nào bật mặc định trừ smoke: dự án không mobile/không responsive thì vai
    mobile chỉ tốn một đợt để báo "không áp dụng". Đổi lại, MỌI vai trong danh mục phải
    có một dòng bật/tắt + căn cứ — tắt có lý do khác hẳn với quên.
    """
    if not read_live(PLAN).strip():
        r.no(f"{PLAN} chưa có — kế hoạch dogfood lập ở pha V của mỗi vòng")
        return
    pr = plan_round()
    if pr != rnd:
        r.no(f"{PLAN} là kế hoạch của vòng {pr if pr else '?'} — chưa lập cho vòng {rnd}")
        r.note("viết lại §1–§3 cho vòng này và đổi dòng `Vòng: N` — skill viper-roles §2")
        return
    errs: list[str] = []
    if UNFILLED in read_live(PLAN):
        errs.append("còn ô _CHƯA ĐIỀN_")
    cat, choice = roster(), plan_choice()
    on = [v for v, (s, _) in choice.items() if s == "bật"]
    miss = [v for v in cat if v not in choice]
    if miss:
        errs.append("§1 thiếu vai của danh mục: " + ", ".join(miss))
    vague = [v for v, (s, why) in choice.items()
             if s not in ("bật", "tắt") or not why.strip() or UNFILLED in why]
    if vague:
        errs.append("§1 vai chưa chọn bật/tắt hoặc thiếu căn cứ: " + ", ".join(vague))
    stray = [v for v in choice if v not in cat]
    if stray:
        errs.append("§1 có vai chưa có thẻ ở viper-roles/roles/: " + ", ".join(stray))
    if ALWAYS_ON not in on:
        errs.append("`smoke` (smoke hồi quy) phải luôn bật")
    if no_ui and any(v in on for v in NO_UI_OFF):
        errs.append("KHÔNG CÓ UI mà vẫn bật " + ", ".join(v for v in NO_UI_OFF if v in on))
    if has_mobile_experience() and "mobile" not in on:
        errs.append("ARCHITECTURE §3 có experience mobile mà vai `mobile` tắt")

    tasks: dict[str, tuple[str, str, str]] = {}
    for h, c in table_cells(section(PLAN, "## 2.")):
        v = _role(c[0]) if c else ""
        if v:
            tasks[v] = (cell_of(h, c, "đợt"), cell_of(h, c, "tài khoản"),
                        cell_of(h, c, "việc vòng này"))
    no_task = [v for v in on if v not in tasks or not tasks[v][2].strip()]
    if no_task:
        errs.append("§2 vai bật mà chưa ghi việc vòng này: " + ", ".join(no_task))
    off_task = [v for v in tasks if v not in on]
    if off_task:
        errs.append("§2 có dòng cho vai đang tắt: " + ", ".join(off_task))
    waves: dict[str, list[str]] = {}
    for v in on:
        if v in tasks:
            waves.setdefault(tasks[v][0].strip(), []).append(v)
    if any(not re.fullmatch(r"\d+", w) for w in waves):
        errs.append("§2 cột Đợt phải là số (0, 1, 2…)")
    if ALWAYS_ON in tasks and waves.get("0") != [ALWAYS_ON]:
        errs.append("đợt 0 phải là `smoke` một mình — chạy đầu tiên, gãy thì sửa trước")
    crowded = {w: vs for w, vs in waves.items() if len(vs) > 3}
    if crowded:
        errs.append("đợt quá 3 vai (chỉ có 3 khe): " + "; ".join(
            f"đợt {w}: {', '.join(vs)}" for w, vs in crowded.items()))
    accts = [tasks[v][1].strip() for v in on if v in tasks]
    if any(not a or UNFILLED in a for a in accts):
        errs.append("§2 vai bật thiếu tài khoản riêng")
    elif len(set(accts)) < len(accts):
        errs.append("§2 hai vai dùng chung một tài khoản — DB chung, dữ liệu sẽ đè nhau")

    froms = [cell_of(h, c, "từ vòng") for h, c in table_cells(section(PLAN, "## 3."))
             if any(x.strip() for x in c)]
    if not froms:
        errs.append("§3 chưa có dòng smoke hồi quy nào (tối thiểu: luồng lõi)")
    elif rnd >= 2 and not any(re.fullmatch(r"\d+", f.strip()) and int(f) < rnd for f in froms):
        errs.append(f"§3 vòng {rnd} chưa có dòng nào của vòng trước — smoke mà không hồi quy")

    if errs:
        for e in errs:
            r.no(f"DOGFOOD-PLAN: {e}")
        r.note("danh mục vai + tín hiệu bật + luật chia đợt: skill viper-roles")
    else:
        r.ok(f"DOGFOOD-PLAN vòng {rnd}: {len(on)} vai bật ({', '.join(on)}) · "
             f"smoke đợt 0 · {len(froms)} dòng smoke hồi quy")


def round_cutoff() -> str | None:
    """Ngày mở vòng (vòng ≥2) — dòng nhật ký cũ hơn ngày này là của vòng trước.
    Vòng 1 → '' (tính hết). Vòng ≥2 mà thiếu `Vòng mở` → None (fail-closed)."""
    m = re.search(r"^Vòng mở\s*:\s*(\d{4}-\d{2}-\d{2})", read_live("STATE.md"), re.MULTILINE)
    if m:
        return m.group(1)
    return "" if current_round() < 2 else None


def check_dogfood_results(r: Report, where: str) -> None:
    """Gate I (local) / P2 (production): kế hoạch đã CHẠY THẬT — §4 Kết quả.

    local: mọi vai bật ≥1 dòng, smoke ≥2 dòng (lượt đầu + lượt cuối sau khi sửa).
    production: smoke ≥1 dòng (đi hết danh sách hồi quy trên production thật).
    Dòng ghi trình duyệt của phiên chính (`mcp__browser__`) là dogfood giả: vai đó
    dùng chung trình duyệt, thấy cảnh của vai khác — không tính.
    """
    rnd = current_round()
    if plan_round() != rnd:
        r.no(f"{PLAN} chưa phải kế hoạch vòng {rnd} — không có gì để đối chiếu kết quả")
        return
    cutoff = round_cutoff()
    done: dict[str, int] = {}
    shared: list[str] = []
    for h, c in table_cells(section(PLAN, "## 4.")):
        day = re.search(r"\d{4}-\d{2}-\d{2}", cell_of(h, c, "ngày"))
        if not day or cutoff is None or day.group(0) < cutoff:
            continue
        if cell_of(h, c, "nơi").strip().lower() != where:
            continue
        v = _role(cell_of(h, c, "vai"))
        if "mcp__browser__" in cell_of(h, c, "trình duyệt"):
            shared.append(v)
            continue
        done[v] = done.get(v, 0) + 1
    on = [v for v, (s, _) in plan_choice().items() if s == "bật"]
    need = {ALWAYS_ON: 1} if where == "production" else {
        v: (2 if v == ALWAYS_ON else 1) for v in on}
    short = [v for v, n in need.items() if done.get(v, 0) < n]
    if shared:
        r.no(f"dogfood {where}: {', '.join(shared)} chạy trên trình duyệt của phiên chính "
             "— dùng chung trình duyệt, không tính")
    if short:
        r.no(f"dogfood {where} chưa đủ theo DOGFOOD-PLAN §4: {', '.join(short)}")
        r.note("smoke ở local cần 2 lượt: đợt 0 + lượt cuối sau khi sửa phát hiện"
               if where == "local" else "smoke phải đi hết §3 trên production thật")
    elif not shared:
        r.ok(f"dogfood {where} đã chạy đủ theo DOGFOOD-PLAN: "
             + ", ".join(f"{v}×{done[v]}" for v in need))


# --- gate từng pha ----------------------------------------------------------

def gate_v(r: Report) -> None:
    print("\nGate V — Validate\n")

    intake = is_intake()

    if filled("context/PRD.md"):
        r.ok("context/PRD.md đã điền")
        # Đòi ô "Làm được gì" có nội dung — dòng scaffold trống (| AC-2 | | |)
        # không được đếm, không thì khoá scope được với một AC thật.
        ac = count_rows("context/PRD.md", r"^\|\s*AC-\d+\s*\|\s*[^|\s]")
        if ac < 3:
            r.no(f"PRD mới có {ac} AC — cần ít nhất 3")
        elif intake:
            # Đường intake KHÔNG có trần AC: một vòng = một lát cắt hệ thống lớn,
            # ép 7 là ép sai cỡ. Đổi lại đòi truy vết — mỗi AC phải gắn với một
            # capability trong CAPABILITIES-MAP, để "nhiều AC" không thành "AC từ
            # trên trời". Đây là hàng rào thay cho trần số.
            cap_cells = cap_ac_cells()
            acs = re.findall(r"^\|\s*(AC-\d+)\s*\|\s*[^|\s]",
                             read_live("context/PRD.md"), re.MULTILINE)
            if cap_cells is None:
                r.no("CAPABILITIES-MAP.md chưa có cột 'AC vòng này' — không truy vết được AC")
                r.note("bảng §1 phải có cột này (xem template) — truy vết là hàng rào "
                       "thay cho trần 7 AC, VIPER.md §1.4")
            else:
                lost = [a for a in acs if not re.search(rf"{a}(?!\d)", cap_cells)]
                if lost:
                    r.no(f"AC chưa truy được về capability nào: {', '.join(lost)}")
                    r.note("đường intake bỏ trần 7 AC, đổi lại mỗi AC phải nằm ở cột "
                           "'AC vòng này' của CAPABILITIES-MAP.md — xem VIPER.md §1.4; "
                           "AC nhắc ở cột khác (Trạng thái…) không tính")
                else:
                    r.ok(f"PRD có {ac} AC, AC nào cũng truy được về CAPABILITIES-MAP")
        elif ac <= 7:
            r.ok(f"PRD có {ac} tiêu chí chấp nhận (3–7)")
        else:
            r.no(f"PRD có {ac} AC — nhiều hơn 7 là scope quá lớn cho một tuần, cắt bớt")
            r.note("trần này của ĐƯỜNG PHỎNG VẤN (một tuần). Hệ thống lớn chia vòng "
                   "thì đi đường intake — VIPER.md §1.3")
        # "Đủ mục" không chỉ là hết _CHƯA ĐIỀN_ — hai mục hay bị xoá/để suông mà
        # filled() không thấy (xoá section là xoá luôn marker _CHƯA ĐIỀN_). Neo bằng
        # SỐ heading như mọi phép kiểm khác: neo bằng cụm chữ trần thì lần nhắc sớm
        # trong thân bài chiếm quyền và cả hai chiều đều sai.
        def prd_body(header: str) -> str:
            parts = section("context/PRD.md", header).split("\n", 2)
            return parts[2] if len(parts) > 2 else ""

        if prd_body("\n## 5.").strip():
            r.ok("PRD có mục Out-of-scope tường minh (§5)")
        else:
            r.no("PRD thiếu mục Out-of-scope (§5) hoặc mục rỗng")
            r.note("scope-lock đứng được là nhờ liệt kê tường minh thứ KHÔNG làm")
        if re.search(r"\d", prd_body("\n## 6.")):
            r.ok("PRD có success metric kèm con số (§6)")
        else:
            r.no("PRD chưa có con số nào ở mục success metric (§6)")
            r.note("MỘT con số + ngưỡng — không có số thì pha R không có căn cứ "
                   "quyết go/pivot/kill")
    else:
        r.no("context/PRD.md chưa điền xong")
        r.note("còn dấu _CHƯA ĐIỀN_ hoặc file rỗng")

    # Cửa vào pha V theo vòng — bản chuẩn: VIPER.md §1.3.
    # VÒNG 1 có hai đường: phỏng vấn 14 mục, hoặc intake MESH-render (INTERVIEW.md
    # mang marker "NGUỒN: INTAKE" ngoài comment → thay 14 dòng bằng chứng bằng bộ
    # kiểm intake; marker không tự đứng — đòi intake/PRD.md là render thật).
    # VÒNG ≥2 KHÔNG phỏng vấn, không dùng intake/PRD.md. INTERVIEW.md đóng băng làm
    # hiện vật vòng 1, gate không đọc nữa (nhánh này phải đứng TRƯỚC nhánh marker:
    # vòng ≥2 không bao giờ rơi về hai đường vòng 1). Nguồn của vòng khác nhau theo
    # chế độ:
    #   phỏng vấn → tài liệu vòng Authority thả vào intake/loops/l<N>/, nó đồng
    #               thời là chữ ký chốt của Authority cho vòng;
    #   intake    → kế hoạch vòng _PROPOSAL.md đã lập từ vòng 1 (Authority đã ký
    #               một lần cho cả kế hoạch), cộng dòng `Rà lại vòng N` do meta ghi
    #               khi mở vòng — đây là thứ chống "gate mọi vòng xanh sẵn từ vòng 1".
    # Fail-closed cả hai: gate chỉ đọc đúng l<N> theo số vòng trong STATE.md.
    rnd = current_round()
    iv_live = read_live("context/INTERVIEW.md")
    if rnd >= 2:
        loop_rel = f"intake/loops/l{rnd}"
        loop_dir = ROOT / loop_rel
        docs = sorted(p.name for p in loop_dir.glob("*.md")
                      if not p.name.startswith("_")) if loop_dir.is_dir() else []
        if intake:
            check_proposal(r, rnd)
            if docs:
                r.ok(f"{loop_rel}/: {len(docs)} tài liệu bổ sung của Authority "
                     f"({', '.join(docs)}) — áp lên kế hoạch vòng")
        elif not docs:
            r.no(f"vòng {rnd}: {loop_rel}/ chưa có tài liệu vòng nào từ Authority")
            r.note("Authority thả file .md mô tả thêm mới / thay đổi / bỏ đi "
                   "(mẫu: intake/loops/_TEMPLATE.md); trả lời qua chat thì meta ghi hộ "
                   "— trích nguyên văn + dòng 'Nguồn: chat với Authority, <ngày>'")
        else:
            texts = {name: read(f"{loop_rel}/{name}") for name in docs}
            empty_docs = [name for name, t in texts.items() if not t.strip()]
            unresolved = [name for name, t in texts.items()
                          if re.search(r"\{\{.+?\}\}", t)]
            for name in empty_docs:
                r.no(f"{loop_rel}/{name} rỗng — chưa phải tài liệu thật")
            for name in unresolved:
                r.no(f"{loop_rel}/{name} còn placeholder {{{{…}}}} — "
                     "không phải bản copy _TEMPLATE.md")
            if not empty_docs and not unresolved:
                r.ok(f"{loop_rel}/: {len(docs)} tài liệu vòng — "
                     f"chữ ký chốt của Authority cho vòng {rnd}")
    elif intake:
        prd_drop = read("intake/PRD.md")
        if not prd_drop.strip():
            r.no("INTERVIEW.md mang NGUỒN: INTAKE mà intake/PRD.md không có — "
                 "marker không tự đứng được")
            r.note("đường intake cần drop thật từ Authority — xem intake/README.md")
        elif re.search(r"\{\{.+?\}\}", prd_drop):
            r.no("intake/PRD.md còn placeholder {{…}} — template chưa resolve, "
                 "không phải render thật")
            r.note("drop phải là output của aggregate-render, không phải bản copy _PRD-TEMPLATE.md")
        elif not re.search(r"^\|\s*CAP-", prd_drop, re.MULTILINE):
            r.no("intake/PRD.md không có dòng capability (| CAP-… |) — thiếu §3, "
                 "không tách được CAPABILITIES-MAP")
        else:
            r.ok("intake/PRD.md là render thật (đã resolve, có capability)")

        if filled("context/INTERVIEW.md") and "## Truy vết" in iv_live:
            r.ok("INTERVIEW.md có bảng truy vết intake → context")
        else:
            r.no("INTERVIEW.md đường intake thiếu bảng '## Truy vết intake → context'")
            r.note("ghi mục nào của context lấy từ file intake nào — xem /viper-validate Đường intake")

        cap_live = read_live("context/CAPABILITIES-MAP.md")
        if filled("context/CAPABILITIES-MAP.md") and \
                re.search(r"^\|\s*CAP-", cap_live, re.MULTILINE):
            r.ok("CAPABILITIES-MAP.md đã tách từ intake PRD §3")
        else:
            r.no("context/CAPABILITIES-MAP.md chưa điền (hoặc không còn dòng CAP-… nào)")
            r.note("đường intake bắt buộc tách PERSONAS.md + CAPABILITIES-MAP.md từ intake/PRD.md")

        check_loop_plan(r)
        # Kế hoạch của vòng 1 cũng theo mẫu chi tiết — pha V vòng này dịch từ nó, và pha R
        # quay video demo theo §2 của nó. Chỉ soi vòng hiện tại: vòng xa được hẹn
        # "chi tiết hoá khi rà lại", gate của vòng đó sẽ soi.
        l1_raw = read(proposal_rel(1))
        if l1_raw.strip():
            if re.search(r"\{\{.+?\}\}", l1_raw):
                r.no(f"{proposal_rel(1)} còn placeholder {{{{…}}}} — chưa phải kế hoạch thật")
            else:
                check_proposal_body(r, 1, read_live(proposal_rel(1)))
    else:
        # Sổ phỏng vấn (chỉ vòng 1): 14 mục, mỗi mục một dòng "Bằng chứng:" không rỗng.
        # Bằng chứng = câu chuyện thật / con số / hiện vật — chống phỏng vấn hời hợt.
        # Phỏng vấn là công cụ mở rộng tư duy lúc khởi đầu — vòng ≥2 đi nhánh
        # tài liệu vòng ở trên, không bao giờ rơi về đây.
        ev = re.findall(r"^Bằng chứng\s*:\s*(.*)$", iv_live, re.MULTILINE)
        n_ev = sum(1 for e in ev if e.strip() and UNFILLED not in e)
        if filled("context/INTERVIEW.md") and len(ev) >= 14 and n_ev == len(ev):
            r.ok(f"INTERVIEW.md có {n_ev} dòng bằng chứng — phỏng vấn có vết")
        else:
            r.no(f"INTERVIEW.md: {n_ev}/14 mục có bằng chứng (câu chuyện thật / con số / hiện vật)")
            r.note("phỏng vấn không bằng chứng là phỏng vấn hời hợt — xem /viper-validate Bước 2")

    if filled("context/PERSONAS.md"):
        personas_live = read_live("context/PERSONAS.md")
        n_persona = count_rows("context/PERSONAS.md", r"^### Persona")
        has_matrix = "## 2. Ma trận" in personas_live
        if n_persona < 1 or not has_matrix:
            r.no("PERSONAS.md thiếu persona (### Persona …) hoặc ma trận vai × hành động (§2)")
        elif not intake and n_persona > 3:
            # Trần của ĐƯỜNG PHỎNG VẤN (VIPER.md §1.1): tối đa 3, thường 2–3;
            # một loại người dùng thì 1 là đủ. Đường intake theo intake PRD, không trần.
            r.no(f"PERSONAS.md có {n_persona} persona — đường phỏng vấn tối đa 3")
            r.note("nhiều vai là dấu hiệu vượt cỡ một tuần — xem VIPER.md §1.3 / đường intake")
        elif intake and not re.search(r"\bP-[A-Za-z0-9]", personas_live):
            r.no("PERSONAS.md đường intake chưa giữ mã P-… của intake PRD §2")
            r.note("dòng 'Mã (intake)' của từng persona phải mang mã gốc để truy vết ngược")
        else:
            r.ok(f"PERSONAS.md có {n_persona} persona + ma trận vai × hành động")
    else:
        r.no("context/PERSONAS.md chưa điền xong")
        r.note("persona + năng lực được cấp + ma trận vai × hành động")

    if filled("context/TECHSTACK.md"):
        r.ok("context/TECHSTACK.md đã chốt stack")
        # Vế thứ hai của gate (VIPER.md §1.1): "+ 1 dòng lý do trong DECISIONS.md".
        # Tìm ở BẤT KỲ vòng nào — stack chốt một lần, vòng sau không phải quyết lại.
        # \b(?:tech)?stack\b: "stack-nextjs" và "TECHSTACK" đều nhận, "haystack" thì không.
        if re.search(r"^\|\s*\d{4}-\d{2}-\d{2}\s*\|[^|\n]*?\b(?:tech)?stack\b",
                     read_live("context/DECISIONS.md"), re.MULTILINE | re.IGNORECASE):
            r.ok("DECISIONS.md có dòng lý do chọn stack")
        else:
            r.no("DECISIONS.md chưa có dòng lý do chọn stack")
            r.note("1 dòng ngày ISO, cột quyết định nhắc chữ 'stack' — TECHSTACK chốt "
                   "phải có vết vì sao (VIPER.md §1.1)")
    else:
        r.no("context/TECHSTACK.md chưa chốt stack")

    if filled("context/ARCHITECTURE.md"):
        r.ok("context/ARCHITECTURE.md đã điền")
    else:
        r.no("context/ARCHITECTURE.md chưa điền xong")

    # Prototype chỉ bắt khi sản phẩm có UI. Backend-only ghi marker "KHÔNG CÓ UI" —
    # marker phải nằm NGOÀI khối <!-- --> (hướng dẫn trong template cũng nhắc tới nó,
    # nhưng nằm trong comment nên read_live không thấy).
    proto_live = read_live("context/PROTOTYPE.md")
    if "KHÔNG CÓ UI" in proto_live:
        r.ok("PROTOTYPE.md: KHÔNG CÓ UI — bỏ qua kiểm prototype (backend-only)")
    elif intake and rnd >= 2 and not loop_has_ui(rnd):
        r.ok(f"vòng {rnd} không đẻ màn mới ({proposal_rel(rnd)}) — bỏ qua prototype")
        r.note("bản đồ màn + design system của vòng trước còn nguyên hiệu lực")
    else:
        if filled("context/PROTOTYPE.md"):
            r.ok("context/PROTOTYPE.md đã điền")
        else:
            r.no("context/PROTOTYPE.md chưa điền xong")
            r.note("backend-only thì thay nội dung bằng dòng: KHÔNG CÓ UI — bỏ qua prototype")
        if prototype_html().strip():
            n_file = len(list((ROOT / "prototype").rglob("*.html"))) if intake else 1
            r.ok(f"prototype đã dựng ({n_file} file HTML)" if intake
                 else "prototype/index.html đã dựng")
        elif intake:
            r.no("prototype/ chưa có file HTML nào — mỗi experience một "
                 "prototype/<tên>/index.html tương tác cho Authority bấm thử")
        else:
            r.no("prototype/index.html chưa có — MỘT file HTML tương tác cho Authority bấm thử")
        if re.search(r"Chốt bởi Authority\s*:\s*\d{4}-\d{2}-\d{2}", proto_live):
            r.ok("Authority đã chốt prototype")
        else:
            r.no("Authority CHƯA chốt prototype — chưa được khoá scope")
            r.note("dựng xong → DỪNG, mời Authority bấm thử → ghi 'Chốt bởi Authority: <ngày>' vào §5")
        # Chỉ đòi map những AC có nội dung — cùng chuẩn với phép đếm AC ở trên.
        acs = re.findall(r"^\|\s*(AC-\d+)\s*\|\s*[^|\s]", read_live("context/PRD.md"), re.MULTILINE)
        missing = [a for a in acs if a not in proto_live]
        if acs and not missing:
            r.ok(f"mọi AC ({len(acs)}) đều map vào màn hình trong PROTOTYPE.md §3")
        elif missing:
            r.no(f"AC chưa map vào màn hình nào trong PROTOTYPE.md §3: {', '.join(missing)}")
        # Có UI thì hình thức cũng phải có nguồn sự thật — token, tương phản, component.
        check_design_system(r, proto_live)

    # Đòi ngày ISO thật: dòng seed của template ghi ngày là "(template)" nên không
    # tính (bootstrap thay 2026-11-21 ở mọi nơi, nên seed không được phép dùng 2026-11-21
    # — dùng là nó thành quyết định "thật" ngay khi dự án vừa sinh ra).
    check_solution(r, rnd)
    check_dogfood_plan(r, rnd, "KHÔNG CÓ UI" in proto_live)

    # Vòng ≥2: repeat.py chèn mốc "| (vòng N) |" vào DECISIONS + dòng `Vòng mở` vào
    # STATE — gate chỉ đếm quyết định DƯỚI mốc ĐÚNG SỐ VÒNG, ngày ≥ `Vòng mở`
    # (VIPER.md §1.1). Thiếu vết nào (bump số vòng bằng tay, script gãy giữa chừng)
    # → FAIL-CLOSED: đếm trên vết sai là để quyết định vòng cũ xanh hộ vòng mới (§1.2).
    dec_live = read_live("context/DECISIONS.md")
    if rnd >= 2:
        marker = None
        for m in re.finditer(rf"^\|\s*\(vòng {rnd}\)\s*\|.*$", dec_live, re.MULTILINE):
            marker = m.end()
        opened = re.search(r"^Vòng mở\s*:\s*(\d{4}-\d{2}-\d{2})",
                           read_live("STATE.md"), re.MULTILINE)
        if marker is None:
            r.no(f"DECISIONS.md chưa có mốc `(vòng {rnd})` — vòng này không mở bằng repeat.py?")
            r.note("mốc là hàng rào đếm theo vòng (VIPER.md §1.2); mở vòng bằng "
                   "`python3 scripts/repeat.py --go`, đừng bump số vòng bằng tay")
        elif opened is None:
            r.no(f"vòng {rnd} mà STATE.md không có dòng `Vòng mở: <ISO>` — "
                 "không lọc được quyết định theo vòng")
            r.note("repeat.py chèn dòng này khi mở vòng; thiếu thì bổ sung đúng ngày mở vòng")
        else:
            dates = re.findall(r"^\|\s*(\d{4}-\d{2}-\d{2})\s*\|",
                               dec_live[marker:], re.MULTILINE)
            d = sum(1 for dt in dates if dt >= opened.group(1))
            if d >= 2:
                r.ok(f"DECISIONS.md có {d} quyết định (từ khi mở vòng)")
            else:
                r.no(f"DECISIONS.md mới có {d} quyết định (từ khi mở vòng) — "
                     "cần ít nhất 2 của vòng này")
                r.note("quyết định của vòng nằm DƯỚI mốc, ngày ≥ `Vòng mở`")
    else:
        d = len(re.findall(r"^\|\s*\d{4}-\d{2}-\d{2}\s*\|", dec_live, re.MULTILINE))
        if d >= 2:
            r.ok(f"DECISIONS.md có {d} quyết định")
        else:
            r.no(f"DECISIONS.md mới có {d} quyết định — cần ít nhất 2 của vòng này")
            r.note("tối thiểu: lý do chọn stack + một quyết định lớn khác (auth, mô hình dữ liệu…)")

    verdict = challenge_last("V")
    if verdict == "PASS":
        r.ok("challenge pha V PASS — tài liệu đã qua chất vấn trước khi khoá scope")
    elif verdict == "FAIL":
        r.no("challenge pha V gần nhất là FAIL — còn câu tài liệu chưa trả lời được")
        if rnd >= 2:
            r.note(f"đọc lại {proposal_rel(rnd)} + kết quả vòng trước, vá chỗ thiếu "
                   "rồi challenge lại — xem /viper-validate mục Vòng ≥ 2")
        elif intake:
            r.note("dịch lại phần đó từ intake + vá lỗ hổng (I2/I3) rồi challenge lại "
                   "— xem /viper-validate Đường intake")
        else:
            r.note("quay lại phỏng vấn phần đó rồi challenge lại — xem /viper-validate Bước 8")
    else:
        r.no("chưa có challenge pha V trong STATE.md §Challenge log")
        r.note("3–5 câu khó nhất mà PRD/PERSONAS/ARCHITECTURE/DESIGN-SYSTEM/PROTOTYPE chưa trả lời được")


def gate_i(r: Report) -> None:
    print("\nGate I — Implement\n")

    for target in ("dev", "check", "migrate"):
        if has_cmd(target):
            r.ok(f"make {target} đã hiện thực")
        else:
            r.no(f"make {target} chưa hiện thực")

    # Luật #8: FAIL nghĩa là CHƯA được code, nên FAIL không phải là gate đã qua.
    # Lọc đúng pha I — challenge V PASS không được tính cho gate này.
    verdict = challenge_last("I")
    if verdict == "PASS":
        r.ok("STATE.md có challenge pha I PASS (luật #8)")
    elif verdict == "FAIL":
        r.no("challenge pha I gần nhất là FAIL — chưa được code")
        r.note("đọc lại context, ra câu hỏi khác, trả lời lại — xem CLAUDE.md §4")
    else:
        r.no("STATE.md chưa có dòng challenge pha I nào")
        r.note("meta phải ra câu hỏi khó + chấm PASS trước khi code — xem CLAUDE.md §4")

    if commit_count() > 1:
        r.ok("đã có commit code")
    else:
        r.no("chưa có commit nào ngoài commit khởi tạo")
    check_dogfood_results(r, "local")

    print()
    r.note("Không kiểm tự động được — tự xác nhận:")
    r.note("  · luồng lõi bấm được end-to-end ở local")
    r.note("  · make check xanh")


GROUPS = ("Nhóm 1", "Nhóm 2", "Nhóm 3", "Nhóm 4")


BC = "context/BACKWARD-COMPATIBILITY-CHECKLIST.md"


def bc_section3(text: str) -> list[str] | None:
    """Các dòng thuộc §3 của BC-checklist — None khi không có heading '## 3'.

    Phạm vi §3 là hợp đồng chung của BA chỗ đếm: gate P1 ở đây, hook guard_bc.py
    (chặn deploy), và repeat.py bước 6b (bỏ tick khi mở vòng). Đếm cả file thì một
    checkbox ghi chú ở §1/§4 chặn deploy vĩnh viễn mà repeat.py không bao giờ re-arm.
    """
    out: list[str] | None = None
    for line in text.splitlines():
        if re.match(r"## 3(?!\d)", line):  # đúng §3 — "## 30. Ghi chú" không tính
            out = []
            continue
        if out is not None and line.startswith("## "):
            break
        if out is not None:
            out.append(line)
    return out


def current_round() -> int:
    m = re.search(r"Vòng\s*:\s*(\d+)", read("STATE.md"))
    return int(m.group(1)) if m else 1


def exp_rel() -> str:
    """Sổ EXPERIMENTS của vòng hiện tại — vòng 1 giữ tên gốc, vòng ≥2 mỗi vòng một
    file (`EXPERIMENTS-v<N>.md`, repeat.py tạo khi mở vòng). Sổ riêng từng vòng là
    hàng rào thay cho reset: số liệu vòng cũ nằm nguyên ở sổ cũ làm insight,
    nhưng không xanh hộ gate E của vòng mới."""
    rnd = current_round()
    return "context/EXPERIMENTS.md" if rnd <= 1 else f"context/EXPERIMENTS-v{rnd}.md"


def gate_p1(r: Report) -> None:
    """Điều kiện VÀO /viper-publish — mọi thứ làm được khi chưa có production."""
    if skip_phase(r, "P", "sẵn sàng deploy lần đầu"):
        return
    print("\nGate P1 — sẵn sàng deploy lần đầu\n")

    for group in GROUPS:
        n = count_unchecked(group, before_deploy_only=True)
        if n == 0:
            r.ok(f"{group} xong phần làm được trước deploy")
        else:
            r.no(f"{group} còn {n} mục chưa tick (chưa kể mục '{AFTER_DEPLOY}')")

    # Tương thích ngược — chỉ có hiệu lực từ vòng 2, khi đã có legacy để giữ.
    # Hook guard_bc.py chặn cứng lệnh deploy theo đúng phép đếm này.
    if current_round() >= 2:
        bc = read(BC)
        if not bc.strip():
            r.no(f"vòng ≥2 mà thiếu {BC}")
            r.note("dự án tạo từ template cũ — chép file từ template mới về rồi điền")
        else:
            sec3 = bc_section3(bc)
            if sec3 is None:
                r.no(f"{BC} không có mục '## 3' — checklist rà mỗi vòng mất khung")
                r.note("chép lại §3 từ template — gate P1 đếm và guard_bc chặn đúng mục này")
            else:
                n = sum(1 for l in sec3 if l.strip().startswith("- [ ]"))
                if n == 0:
                    r.ok("tương thích ngược: checklist §3 xanh — legacy được giữ")
                else:
                    r.no(f"tương thích ngược: còn {n} mục chưa rà trong {BC} §3")
                    r.note("hook guard_bc chặn deploy tới khi xanh — luật đổi từng loại ở §2 của file đó")

    for target in ("test", "deploy", "doctor"):
        if has_cmd(target):
            r.ok(f"make {target} đã hiện thực")
        else:
            r.no(f"make {target} chưa hiện thực")

    print()
    r.note("Không kiểm tự động được — tự xác nhận:")
    r.note("  · make check && make test xanh")
    r.note("  · phép thử phân quyền A↛B đã chạy ở local")


def gate_p2(r: Report) -> None:
    """Điều kiện RỜI pha P sang E — production đã sống và đã kiểm."""
    if skip_phase(r, "P", "production đã sống"):
        return
    print("\nGate P2 — production đã sống\n")

    for group in GROUPS:
        n = count_unchecked(group)
        if n == 0:
            r.ok(f"{group} xanh")
        else:
            r.no(f"{group} còn {n} mục chưa tick")

    # "Đủ §1–§5, có rollback" (VIPER.md §1.1) — filled() không thấy section bị xoá.
    dep_live = read_live("context/shared/DEPLOY.md")
    dep_missing = [f"§{i}" for i in range(1, 6)
                   if not re.search(rf"^## {i}\.", dep_live, re.MULTILINE)]
    # Thân §5 phải có nội dung: heading "## 5. Rollback" tự chứa chữ rollback,
    # không đòi thân thì mục rỗng vẫn xanh.
    sec5 = dep_live.split("\n## 5.", 1)
    sec5_body = (sec5[1].split("\n", 1)[1].split("\n## ", 1)[0]
                 if len(sec5) > 1 and "\n" in sec5[1] else "")
    if not filled("context/shared/DEPLOY.md"):
        r.no("DEPLOY.md chưa điền — phải xong TRƯỚC lần deploy đầu")
    elif dep_missing or not re.search(r"rollback", dep_live, re.IGNORECASE):
        r.no("DEPLOY.md " + (f"thiếu mục {', '.join(dep_missing)}" if dep_missing
                             else "không nhắc rollback ở đâu cả"))
        r.note("đủ §1–§5 và có rollback đã thử — viết cho lúc 11 giờ đêm production hỏng")
    elif not sec5_body.strip():
        r.no("DEPLOY.md §5 (Rollback) rỗng — heading không thay được nội dung")
        r.note("lệnh rollback + mất bao lâu + ảnh hưởng dữ liệu — điền TRƯỚC lần deploy đầu")
    else:
        r.ok("DEPLOY.md đã điền đủ §1–§5, có rollback")
    check_dogfood_results(r, "production")

    print()
    r.note("Không kiểm tự động được — tự xác nhận:")
    r.note("  · production sống, health check 200")
    r.note("  · đã THỬ rollback một lần")


def gate_p(r: Report) -> None:
    """Pha P nói chung — in cả hai nửa để thấy đang đứng ở đâu."""
    if skip_phase(r, "P", "Polish & Publish"):
        return
    gate_p1(r)
    gate_p2(r)


def gate_e(r: Report) -> None:
    if skip_phase(r, "E", "Evaluate"):
        return
    print("\nGate E — Evaluate\n")

    exp = exp_rel()
    name = Path(exp).name
    if filled(exp):
        r.ok(f"{name} đã điền giả thuyết")
    else:
        r.no(f"{name} chưa điền giả thuyết + ngưỡng")
        if not read(exp).strip() and current_round() >= 2:
            r.note("sổ đo riêng của vòng này — repeat.py --go tạo sẵn khi mở "
                   "vòng; quay vòng bằng bản cũ thì tạo tay từ scaffold trong "
                   "scripts/repeat.py")

    rows = count_rows_in(exp, "## Số liệu theo ngày",
                         r"^\|\s*\d{4}-\d{2}-\d{2}\s*\|")
    if rows >= 1:
        r.ok(f"có {rows} dòng số liệu thật (§Số liệu theo ngày)")
    else:
        r.no("chưa có dòng số liệu nào trong §Số liệu theo ngày")
        r.note("dòng ngày ở bảng phản hồi/thử nghiệm không tính — "
               "không đo thì cuối tuần không có căn cứ quyết go hay kill")

    print()
    r.note("Không kiểm tự động được — tự xác nhận:")
    r.note("  · analytics + event tracking đang đếm thật")
    r.note("  · ngưỡng go/pivot/kill ghi TRƯỚC khi nhìn số liệu")


# --- video demo cuối vòng (gate R) -------------------------------------------

DEMOS = "context/DEMOS.md"
VIDEO_EXT = (".webm", ".mp4", ".mov")


def demo_section(rnd: int) -> str:
    """Mục `## Vòng N` của DEMOS.md (đã bỏ comment), tới `## ` kế tiếp. "" nếu chưa có.

    Neo bằng regex có ranh giới số: find("## Vòng 1") khớp nhầm "## Vòng 12", tức mục
    của vòng sau xanh hộ vòng trước. Giữ ĐỒNG BỘ với thông điệp của repeat.py.
    """
    text = read_live(DEMOS)
    m = re.search(rf"^## Vòng {rnd}(?!\d).*$", text, re.MULTILINE)
    if not m:
        return ""
    j = text.find("\n## ", m.end())
    return text[m.start(): j if j > 0 else len(text)]


def check_demo(r: Report, rnd: int) -> None:
    """Video demo cuối vòng (VIPER.md §1.5) — mọi vòng, cả hai đường, kể cả vòng chỉ V+I.

    Đây là phần MÁY KIỂM ĐƯỢC của pha R: Authority review theo lô, và vòng chưa deploy
    thì video là cách duy nhất Authority thấy vòng đã giao gì. Chỉ đọc mục của vòng
    hiện tại — mục vòng cũ không xanh hộ vòng mới, và file phải nằm đúng demos/vong-<N>/.
    """
    sec = demo_section(rnd)
    if not sec:
        r.no(f"{DEMOS} chưa có mục `## Vòng {rnd}` — chưa quay video demo cuối vòng")
        r.note("quay kịch bản demo của vòng trên sản phẩm thật rồi ghi một mục — "
               "VIPER.md §1.5, /viper-repeat Bước 2")
        return
    r.ok(f"{DEMOS}: có mục `## Vòng {rnd}`")

    env = re.search(r"^Môi trường\s*:\s*(\S.*)$", sec, re.MULTILINE)
    if env:
        r.ok(f"demo quay ở: {env.group(1).strip()[:80]}")
        deployed = "P" in loop_phases(rnd) and not re.search(
            r"^URL production\s*:\s*\(chưa có\)", read("STATE.md"), re.MULTILINE)
        if deployed and "production" not in env.group(1).lower():
            r.note("⚠ vòng này đã deploy mà demo không quay trên production — Authority "
                   "nên thấy đúng thứ người dùng thật đang thấy (tài khoản demo)")
    else:
        r.no("mục demo thiếu dòng `Môi trường: …` — quay ở đâu, commit nào")
        r.note("đã deploy → production + tài khoản demo · chưa → local, seed mới tinh")

    files = sorted({f.rstrip(".") for f in re.findall(rf"demos/vong-{rnd}/[\w.\-/]+", sec)})
    if not files:
        r.no(f"mục demo chưa liệt kê tệp nào ở demos/vong-{rnd}/")
        r.note(f"dòng `Tệp : demos/vong-{rnd}/<experience>.webm` — file của vòng nào nằm "
               "đúng thư mục vòng đó")
    else:
        bad = [f for f in files if not (ROOT / f).is_file() or (ROOT / f).stat().st_size == 0]
        if bad:
            r.no(f"tệp demo không có hoặc rỗng: {', '.join(bad)}")
            r.note("video không commit (.gitignore) — quay trên máy này rồi chạy lại gate")
        else:
            r.ok(f"{len(files)} tệp demo có thật: {', '.join(files)}")
        no_ui = "KHÔNG CÓ UI" in read_live("context/PROTOTYPE.md")
        if not no_ui and not any(f.lower().endswith(VIDEO_EXT) for f in files):
            r.no("sản phẩm có UI mà demo không có video (.webm · .mp4 · .mov)")
            r.note("bản ghi terminal .log chỉ thay được video khi backend-only (KHÔNG CÓ UI)")

    rows = [(h, c) for h, c in table_cells(sec) if any("bước" in x.lower() for x in h)]
    if rows:
        r.ok(f"bảng bước demo: {len(rows)} dòng")
    else:
        r.no("mục demo chưa có bảng bước (Bước · Làm gì · Thấy gì · AC · Kết quả)")
        r.note("mỗi bước một chương video — người xem biết đang thấy AC nào")

    acs = re.findall(r"^\|\s*(AC-\d+)\s*\|\s*[^|\s]", read_live("context/PRD.md"),
                     re.MULTILINE)
    lost = [a for a in dict.fromkeys(acs) if not re.search(rf"{a}(?!\d)", sec)]
    if lost:
        r.no(f"AC của vòng chưa có mặt trong demo: {', '.join(lost)}")
        r.note("AC chỉ test bắt được → dòng `ngoài video` + tên test; AC không giao được "
               "→ dòng `dời — DECISIONS <ngày>`")
    elif acs:
        r.ok(f"mọi AC của vòng ({len(set(acs))}) có mặt trong demo")

    broken = [cell_of(h, c, "bước") or "?" for h, c in rows
              if re.search(r"✗|không đạt", cell_of(h, c, "kết quả"), re.IGNORECASE)]
    if broken:
        r.no(f"bước demo không đạt: {', '.join(broken)} — sản phẩm gãy ngay trên kịch bản")
        r.note("sửa → smoke lại → quay lại từ đầu; không sửa được trong vòng thì AC đó "
               "dời (ghi `dời — DECISIONS <ngày>`, đẩy ROADMAP.md) — không cắt ghép che lỗi")


def gate_r(r: Report) -> None:
    """Pha R: video demo cuối vòng là phần máy kiểm; quyết định là việc của người.

    Vòng nào cũng phải có video, kể cả vòng không chạy pha E: không có số liệu để quyết
    go/pivot/kill thì R rút về sổ sách — nhưng sổ sách gồm cả video, vì đó là chỗ
    Authority thấy vòng đã giao gì (VIPER.md §1.5). repeat.py chạy gate này trước khi
    quay vòng và từ chối khi đỏ.
    """
    rnd = current_round()
    print(f"\nGate R — Repeat (vòng {rnd})\n")
    # Authority bỏ yêu cầu video demo khỏi gate R (DECISIONS 2026-11-24) — check_demo giữ lại
    # để dùng tay khi muốn, nhưng không còn chặn quay vòng.
    r.ok("video demo cuối vòng: không bắt buộc (DECISIONS 2026-11-24)")

    print()
    r.note("Không kiểm tự động được — tự xác nhận:")
    if "E" in loop_phases(rnd):
        r.note("  · quyết định go / pivot / kill ghi ở context/DECISIONS.md"
               f" + {exp_rel()} §Quyết định cuối tuần")
    else:
        r.note(f"  · vòng {rnd} không chạy pha E ({proposal_rel(rnd)}) — không có số liệu để "
               "quyết go/pivot/kill; R chỉ là sổ sách theo context/ROADMAP.md §1")
    r.note("  · ROADMAP.md cập nhật — backlog §3, và (intake) trạng thái vòng ở §1")
    r.note("  · mở vòng mới: python3 scripts/repeat.py --go (xem /viper-repeat)")


GATES = {
    "V": gate_v,
    "I": gate_i,
    "P": gate_p,    # cả hai nửa
    "P1": gate_p1,  # điều kiện vào /viper-publish
    "P2": gate_p2,  # điều kiện rời pha P
    "E": gate_e,
    "R": gate_r,    # video demo cuối vòng — repeat.py chạy gate này trước khi quay vòng
}


def usage() -> int:
    print("Usage: python3 scripts/gate.py [V|I|P|P1|P2|E|R]", file=sys.stderr)
    print("       (không truyền pha → tự đọc từ STATE.md)\n", file=sys.stderr)
    print("  V   Validate  — PRD, persona, stack, kiến trúc, design system, prototype, scope khoá", file=sys.stderr)
    print("  I   Implement — chạy được ở local, đã dogfood", file=sys.stderr)
    print("  P1  Polish    — sẵn sàng deploy lần đầu", file=sys.stderr)
    print("  P2  Publish   — production sống, đã kiểm, đã thử rollback", file=sys.stderr)
    print("  P   (cả P1 và P2)", file=sys.stderr)
    print("  E   Evaluate  — có số liệu thật", file=sys.stderr)
    print("  R   Repeat    — video demo cuối vòng (go/pivot/kill là việc của người)", file=sys.stderr)
    print("\nĐường intake: V và I bắt buộc mọi vòng; P/E/R chỉ áp ở vòng khai chúng", file=sys.stderr)
    print("trong intake/loops/l<N>/_PROPOSAL.md (VIPER.md §1.4).", file=sys.stderr)
    return 2


def main(argv: list[str]) -> int:
    arg = argv[1].upper() if len(argv) > 1 else ""

    if arg in ("-H", "--HELP"):
        return usage()

    if not arg:
        detected = phase_from_state()
        if detected is None:
            print("Không đọc được pha hiện tại từ STATE.md.\n", file=sys.stderr)
            return usage()
        arg = detected
        print(f"{GREY}(đọc pha {arg} từ STATE.md){RESET}")

    if arg not in GATES:
        return usage()

    r = Report()
    GATES[arg](r)

    total = r.passed + r.failed
    print()
    # Nhắc vệ sinh tài liệu — CHỈ là gợi ý, không đụng passed/failed, không đổi exit
    # code. Tài liệu không reset qua các vòng (VIPER.md §1.2) nên các sổ chỉ dài ra;
    # từ vòng 3 mới đủ lịch sử để có thứ đáng gấp.
    if current_round() >= 3:
        print(f"{GREY}· vòng {current_round()} — chạy `python3 scripts/compact.py` xem "
              f"context/ đã tích rác chưa (xem /viper-compact){RESET}")
    if r.failed == 0:
        print(f"{GREEN}✓ Gate {arg}: {r.passed}/{total} — qua được{RESET}\n")
        return 0
    print(f"{RED}✗ Gate {arg}: {r.passed}/{total} — còn {r.failed} mục{RESET}\n")
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except BrokenPipeError:
        # bị cắt giữa chừng bởi `| head` — im lặng thoát, đừng in traceback
        import os

        os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
