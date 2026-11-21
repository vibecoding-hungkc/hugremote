"""heartbeat.py — dấu vết hook đã chạy (lld §9). Không bao giờ ném lỗi ra ngoài."""
from __future__ import annotations

import json
import time
from pathlib import Path


def touch(root: Path, provider: str, event: str, *, unknown_tool: str | None = None,
          error: str | None = None) -> None:
    try:
        path = root / ".viper" / "kit" / "hook-heartbeat" / f"{provider}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            data = {}
        data["last"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        events = data.setdefault("events", {})
        events[event] = int(events.get(event, 0)) + 1
        if unknown_tool:
            tools = data.setdefault("unknown_tools", [])
            if unknown_tool not in tools:
                tools.append(unknown_tool)
        if error:
            errors = data.setdefault("errors", [])
            errors.append(f"{data['last']} {error[:300]}")
            del errors[:-20]
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    except Exception:  # noqa: BLE001 — heartbeat hỏng không được làm hỏng hook
        pass
