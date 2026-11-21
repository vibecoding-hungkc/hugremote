#!/usr/bin/env python3
"""guard_bc.py — hook PreToolUse (Bash): chặn deploy khi vòng ≥2 còn nợ tương thích ngược.

VÌ SAO CÓ FILE NÀY
    Từ vòng 2, production có người dùng và dữ liệu thật — legacy là hợp đồng (VIPER.md §1.2).
    `context/BACKWARD-COMPATIBILITY-CHECKLIST.md §3` là danh sách phải rà trước khi deploy;
    gate P1 đếm nó nhưng gate chỉ BÁO. Deploy là hành động phá hợp đồng không thu hồi được
    với client/hệ thống ngoài đang bám vào schema cũ — nên chỗ này cần chặn cứng, cùng
    triết lý với guard_ask: cấm bằng văn xuôi không giữ được luật, nhất là sau compact.

CHẠY NHƯ THẾ NÀO
    Claude Code gọi qua hook PreToolUse matcher "Bash" (xem .claude/settings.json).
    stdin : JSON có tool_input.command
    exit 0: cho qua · exit 2: CHẶN, stderr được đưa lại cho model

    Chỉ soi lệnh deploy (danh sách DEPLOY_PATTERNS — `make deploy` là cổng chính thức
    theo hợp đồng lệnh). `git push` KHÔNG chặn ở đây: nó đã nằm ở lớp `ask` permission,
    và chặn push trong lúc đang code giữa vòng là ma sát sai chỗ.

    Fail-open có chủ đích: không đọc được STATE.md / thiếu checklist (dự án tạo từ
    template cũ) / JSON hỏng → cho qua. Hook an toàn không bao giờ được chặn nhầm phiên.

Exit codes: 0 cho qua · 2 chặn
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BC = "context/BACKWARD-COMPATIBILITY-CHECKLIST.md"

# Lệnh coi là deploy. Cố tình hẹp: make deploy (hợp đồng lệnh) + dạng deploy tường minh
# của CLI các PaaS trong kho stack. KHÔNG gồm `vercel dev` / `vercel env pull` (không deploy);
# `vercel` trần đứng cuối lệnh thì tính (mặc định của nó là deploy).
DEPLOY_PATTERNS = (
    # make: quét theo token — mọi thứ đứng giữa `make` và target `deploy` (cờ -j4,
    # -C dir, -Cdir, --directory=dir, biến VAR=val…) đều không thoát được; chỉ chặn
    # khi `deploy` là token trọn vẹn (make deploy-docs không tính). Liệt kê từng
    # dạng cờ là thua thực tế — đường intake đa target chạy make đủ kiểu.
    r"\bmake\b(?:\s+\S+)*?\s+deploy(?![\w.-])",
    r"\bvercel\s+(deploy|--prod)\b",
    r"\bvercel\s*$",
    r"\brailway\s+up\b",
    # fly/flyctl: global flag đứng trước subcommand (fly --app x deploy) vẫn chặn.
    r"\bfly(?:ctl)?\b(?:\s+\S+)*?\s+deploy(?![\w.-])",
    r"\brender\s+deploy\b",
)


def read(rel: str) -> str:
    try:
        return (ROOT / rel).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return ""


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0  # fail-open
    command = str((payload.get("tool_input") or {}).get("command") or "")
    if not any(re.search(p, command) for p in DEPLOY_PATTERNS):
        return 0

    m = re.search(r"Vòng\s*:\s*(\d+)", read("STATE.md"))
    if not m or int(m.group(1)) < 2:
        return 0  # vòng 1 chưa có legacy — không có gì để tương thích

    bc = read(BC)
    if not bc.strip():
        return 0  # dự án từ template cũ chưa có checklist — fail-open, gate P1 sẽ nhắc

    # CHỈ đếm §3 — cùng phạm vi với gate P1 (bc_section3 trong gate.py) và repeat.py
    # bước 6b (bỏ tick §3 khi mở vòng). Đếm cả file thì một checkbox ghi chú ở §1/§4
    # chặn deploy vĩnh viễn mà repeat.py không bao giờ re-arm nó.
    sec3: list[str] | None = None
    for line in bc.splitlines():
        if re.match(r"## 3(?!\d)", line):  # đúng §3 — "## 30. Ghi chú" không tính
            sec3 = []
            continue
        if sec3 is not None and line.startswith("## "):
            break
        if sec3 is not None:
            sec3.append(line)
    if sec3 is None:
        return 0  # checklist sửa tay mất khung §3 — fail-open, gate P1 sẽ báo đỏ

    unticked = [l.strip() for l in sec3 if l.strip().startswith("- [ ]")]
    if not unticked:
        return 0

    print(
        f"[VIPER guard_bc] CHẶN deploy — vòng ≥2 còn {len(unticked)} mục tương thích ngược "
        f"chưa rà trong {BC} §3:\n"
        + "\n".join(f"  {l}" for l in unticked[:4])
        + ("\n  …" if len(unticked) > 4 else "")
        + "\n\nLegacy là hợp đồng (VIPER.md §1.2). Rà từng mục theo luật §2 của checklist "
        "(đối chiếu sổ hợp đồng §1), tick xong chạy lại. Mục không áp dụng → tick kèm 'n/a'. "
        "Chỗ nào buộc phải phá mà Authority CHƯA chốt ở một trong ba nơi hợp lệ — "
        "tài liệu vòng intake/loops/l<N>/*.md · mục 'Legacy được phép phá' trong "
        "intake/loops/l<N>/_PROPOSAL.md · chốt qua chat ở pha V (meta ghi hộ vào đó) "
        "→ đó là ngoại lệ hỏi thật, dừng lại hỏi Authority.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # hook KHÔNG BAO GIỜ được làm hỏng phiên
        print(f"guard_bc.py: {e}", file=sys.stderr)
        sys.exit(0)
