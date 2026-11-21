"""ds_scope.py — phạm vi + điều kiện bật của guard_ds VIPER, cho adapter (lld §6.2 "Không dựng được nội dung").

Adapter không dựng được nội dung sau ghi (patch khớp mờ, dạng chưa đo) thì chặn khi và chỉ khi guard_ds
đang soi path đó — cùng điều kiện guard_ds.py tự kiểm: prototype/*.html|htm|css hoặc context/DESIGN-SYSTEM.md,
và DESIGN-SYSTEM.md đã chốt.
"""
from __future__ import annotations

import os
import re
from pathlib import Path


def guarded_by_ds(path: str, root: Path) -> bool:
    try:
        rel = Path(os.path.realpath(path)).relative_to(Path(os.path.realpath(root))).as_posix()
    except ValueError:
        return False
    if not ((rel.startswith("prototype/") and rel.endswith((".html", ".htm", ".css"))) or rel == "context/DESIGN-SYSTEM.md"):
        return False
    return ds_active(root)


def ds_active(root: Path) -> bool:
    """DESIGN-SYSTEM.md đã chốt (điều kiện guard_ds tự kiểm)."""
    try:
        ds = (root / "context" / "DESIGN-SYSTEM.md").read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return False
    ds_visible = re.sub(r"<!--.*?-->", "", ds, flags=re.S)
    return bool(ds.strip()) and "_CHƯA ĐIỀN_" not in ds and "KHÔNG CÓ UI" not in ds_visible


def rewrite_whole_file(path: str) -> str:
    return (f"[viper-kit] Không kiểm được nội dung sau khi sửa {Path(path).name} — file này phải theo design system "
            "đã chốt: ghi lại cả file bằng một thao tác ghi cả file.")
