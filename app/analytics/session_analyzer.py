from __future__ import annotations

from datetime import datetime

import numpy as np

from .metrics import AnalysisConfig, analyze_effort_samples
from .models import EffortMetrics, ForceSample, SessionSummary
from .segmentation import SegmenterConfig, segment_efforts


def analyze_session(
    samples: list[ForceSample],
    hand: str,
    segment_cfg: SegmenterConfig,
    analysis_cfg: AnalysisConfig,
    session_id: str,
    started_at_iso: str,
    ended_at_iso: str | None = None,
) -> tuple[list[EffortMetrics], SessionSummary]:
    if ended_at_iso is None:
        ended_at_iso = datetime.utcnow().isoformat(timespec="seconds")

    ranges = segment_efforts(samples, segment_cfg)
    efforts: list[EffortMetrics] = []

    for i, (start_idx, end_idx) in enumerate(ranges, start=1):
        seg = samples[start_idx : end_idx + 1]
        if len(seg) < 2:
            continue
        efforts.append(analyze_effort_samples(seg, effort_id=i, config=analysis_cfg))

    peaks = np.array([e.peak_total_kg for e in efforts], dtype=float)
    if len(peaks) >= 2:
        x = np.arange(len(peaks), dtype=float)
        fatigue_slope = float(np.polyfit(x, peaks, 1)[0])
        first_to_last_drop_pct = float(((peaks[-1] - peaks[0]) / peaks[0]) * 100.0) if peaks[0] > 1e-9 else 0.0
    else:
        fatigue_slope = 0.0
        first_to_last_drop_pct = 0.0

    summary = SessionSummary(
        session_id=session_id,
        started_at_iso=started_at_iso,
        ended_at_iso=ended_at_iso,
        hand=hand,
        efforts_count=len(efforts),
        best_peak_kg=float(np.max(peaks)) if len(peaks) else 0.0,
        avg_peak_kg=float(np.mean(peaks)) if len(peaks) else 0.0,
        fatigue_slope_kg_per_effort=fatigue_slope,
        first_to_last_drop_pct=first_to_last_drop_pct,
    )
    return efforts, summary
