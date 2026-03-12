from __future__ import annotations

import json
from typing import Optional

from .base import AcquisitionSample


def status_message_from_line(line: str) -> str | None:
    text = line.strip()
    if not text:
        return None

    if text.startswith("#"):
        return text[1:].strip() or "#"

    lower = text.lower()
    if lower.startswith(("err", "ok")) or "usage" in lower:
        return text
    return None


def parse_sample_line(line: str, fallback_t_ms: int) -> Optional[AcquisitionSample]:
    text = line.strip()
    if not text:
        return None

    # JSON format: {"t_ms":123,"f":[x0,x1,x2,x3]}
    if text.startswith("{"):
        try:
            obj = json.loads(text)
        except Exception:
            return None
        values = obj.get("f")
        if not isinstance(values, list) or len(values) != 4:
            return None
        try:
            parsed = tuple(float(v) for v in values)
        except Exception:
            return None
        t_ms = obj.get("t_ms")
        ts = int(t_ms) if isinstance(t_ms, (int, float)) else int(fallback_t_ms)
        return AcquisitionSample(t_ms=ts, values=parsed)

    # CSV format: t_ms,f_index,f_middle,f_ring,f_pinky
    # Legacy fallback: f_index,f_middle,f_ring,f_pinky
    parts = [p.strip() for p in text.split(",")]
    if len(parts) not in (4, 5):
        return None

    if len(parts) == 5:
        try:
            t_ms = int(float(parts[0]))
            values = tuple(float(v) for v in parts[1:5])
        except Exception:
            return None
        return AcquisitionSample(t_ms=t_ms, values=values)

    try:
        values = tuple(float(v) for v in parts[0:4])
    except Exception:
        return None
    return AcquisitionSample(t_ms=int(fallback_t_ms), values=values)

