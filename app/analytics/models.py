from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

KG_TO_N = 9.80665


@dataclass(slots=True)
class ForceSample:
    """Canonical sample stored/processed in kilograms."""

    t_ms: int
    raw: tuple[float, float, float, float]
    kg: tuple[float, float, float, float]

    @property
    def total_kg(self) -> float:
        return float(sum(self.kg))

    @property
    def total_n(self) -> float:
        return self.total_kg * KG_TO_N


@dataclass(slots=True)
class EffortMetrics:
    effort_id: int
    start_t_ms: int
    end_t_ms: int
    duration_s: float

    peak_total_kg: float
    peak_per_finger_kg: tuple[float, float, float, float]
    time_to_peak_s: float

    rfd_100_kg_s: float
    rfd_200_kg_s: float
    rfd_100_n_s: float
    rfd_200_n_s: float

    avg_total_kg: float
    tut_s: float

    distribution_drift_per_s: float
    steadiness_total_kg: float
    steadiness_per_finger_kg: tuple[float, float, float, float]

    finger_imbalance_index: float
    load_variation_cv: float
    dominant_switch_count: int
    load_shift_rate: float
    stabilization_time_s: float | None
    ring_pinky_share: float

    hold_start_t_ms: int
    hold_end_t_ms: int

    detail_t_ms: list[int] = field(default_factory=list)
    detail_total_kg: list[float] = field(default_factory=list)
    detail_finger_kg: list[tuple[float, float, float, float]] = field(default_factory=list)
    detail_finger_pct: list[tuple[float, float, float, float]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class SessionSummary:
    session_id: str
    started_at_iso: str
    ended_at_iso: str
    hand: str
    efforts_count: int

    best_peak_kg: float
    avg_peak_kg: float
    fatigue_slope_kg_per_effort: float
    first_to_last_drop_pct: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
