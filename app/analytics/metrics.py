from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .models import EffortMetrics, ForceSample, KG_TO_N


@dataclass(slots=True)
class AnalysisConfig:
    tut_threshold_kg: float = 0.5
    hold_peak_fraction: float = 0.9
    stabilization_shift_threshold: float = 0.8  # sum(|dp_i/dt|), where p_i in [0,1]
    stabilization_hold_ms: int = 250


def _interp_at_ms(times_ms: np.ndarray, values: np.ndarray, target_ms: float) -> float:
    if len(times_ms) == 0:
        return 0.0
    if target_ms <= times_ms[0]:
        return float(values[0])
    if target_ms >= times_ms[-1]:
        return float(values[-1])

    idx = int(np.searchsorted(times_ms, target_ms, side="left"))
    if idx <= 0:
        return float(values[0])
    t0, t1 = float(times_ms[idx - 1]), float(times_ms[idx])
    v0, v1 = float(values[idx - 1]), float(values[idx])
    if t1 <= t0:
        return v1
    frac = (target_ms - t0) / (t1 - t0)
    return (v0 * (1.0 - frac)) + (v1 * frac)


def _duration_above_threshold_s(times_ms: np.ndarray, values: np.ndarray, threshold: float) -> float:
    if len(times_ms) < 2:
        return 0.0
    acc_ms = 0.0
    for i in range(len(values) - 1):
        if values[i] >= threshold:
            acc_ms += max(0.0, times_ms[i + 1] - times_ms[i])
    return acc_ms / 1000.0


def _percentages(fingers_kg: np.ndarray, total_kg: np.ndarray) -> np.ndarray:
    out = np.zeros_like(fingers_kg)
    valid = total_kg > 1e-9
    if np.any(valid):
        out[valid] = fingers_kg[valid] / total_kg[valid, None]
    return out


def _load_shift_rate_series(times_ms: np.ndarray, pct: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if len(times_ms) < 2:
        return np.array([], dtype=float), np.array([], dtype=float)

    dt_s = np.diff(times_ms) / 1000.0
    dt_s[dt_s <= 0.0] = 1e-6
    dp = np.abs(np.diff(pct, axis=0))
    shift = np.sum(dp, axis=1) / dt_s
    t_ref = times_ms[1:]
    return t_ref, shift


def _stabilization_time_s(
    times_ms: np.ndarray,
    pct: np.ndarray,
    start_t_ms: int,
    threshold: float,
    hold_ms: int,
) -> float | None:
    t_ref, shift = _load_shift_rate_series(times_ms, pct)
    if len(shift) == 0:
        return None

    candidate_start: float | None = None
    accum_ms = 0.0

    for i, rate in enumerate(shift):
        if rate < threshold:
            if candidate_start is None:
                candidate_start = float(t_ref[i])
                accum_ms = 0.0
            if i > 0:
                accum_ms += max(0.0, float(t_ref[i] - t_ref[i - 1]))
            if accum_ms >= hold_ms and candidate_start is not None:
                return max(0.0, (candidate_start - start_t_ms) / 1000.0)
        else:
            candidate_start = None
            accum_ms = 0.0
    return None


def _rfd_kg_s(times_ms: np.ndarray, total_kg: np.ndarray, t0_ms: int, window_ms: int) -> float:
    if len(times_ms) == 0:
        return 0.0
    f0 = _interp_at_ms(times_ms, total_kg, float(t0_ms))
    f1 = _interp_at_ms(times_ms, total_kg, float(t0_ms + window_ms))
    return (f1 - f0) / (window_ms / 1000.0)


def analyze_effort_samples(
    effort_samples: list[ForceSample],
    effort_id: int,
    config: AnalysisConfig,
) -> EffortMetrics:
    if len(effort_samples) < 2:
        s = effort_samples[0]
        return EffortMetrics(
            effort_id=effort_id,
            start_t_ms=s.t_ms,
            end_t_ms=s.t_ms,
            duration_s=0.0,
            peak_total_kg=s.total_kg,
            peak_per_finger_kg=s.kg,
            time_to_peak_s=0.0,
            rfd_100_kg_s=0.0,
            rfd_200_kg_s=0.0,
            rfd_100_n_s=0.0,
            rfd_200_n_s=0.0,
            avg_total_kg=s.total_kg,
            tut_s=0.0,
            distribution_drift_per_s=0.0,
            steadiness_total_kg=0.0,
            steadiness_per_finger_kg=(0.0, 0.0, 0.0, 0.0),
            finger_imbalance_index=0.0,
            load_variation_cv=0.0,
            dominant_switch_count=0,
            load_shift_rate=0.0,
            stabilization_time_s=None,
            ring_pinky_share=0.0,
            hold_start_t_ms=s.t_ms,
            hold_end_t_ms=s.t_ms,
            detail_t_ms=[0],
            detail_total_kg=[s.total_kg],
            detail_finger_kg=[s.kg],
            detail_finger_pct=[(0.0, 0.0, 0.0, 0.0)],
        )

    times_ms = np.array([s.t_ms for s in effort_samples], dtype=float)
    fingers = np.array([s.kg for s in effort_samples], dtype=float)
    total = np.sum(fingers, axis=1)

    start_t_ms = int(times_ms[0])
    end_t_ms = int(times_ms[-1])
    duration_s = max(0.0, (end_t_ms - start_t_ms) / 1000.0)

    peak_idx = int(np.argmax(total))
    peak_total = float(total[peak_idx])
    peak_fingers = tuple(float(v) for v in fingers[peak_idx])
    time_to_peak_s = max(0.0, (float(times_ms[peak_idx]) - start_t_ms) / 1000.0)

    rfd_100 = _rfd_kg_s(times_ms, total, start_t_ms, 100)
    rfd_200 = _rfd_kg_s(times_ms, total, start_t_ms, 200)

    hold_threshold = config.hold_peak_fraction * peak_total
    hold_idx = 0
    for i in range(len(total)):
        if total[i] >= hold_threshold:
            hold_idx = i
            break

    hold_times = times_ms[hold_idx:]
    hold_fingers = fingers[hold_idx:]
    hold_total = total[hold_idx:]

    pct_all = _percentages(fingers, total)
    pct_hold = _percentages(hold_fingers, hold_total)

    hold_start_t_ms = int(times_ms[hold_idx])
    hold_end_t_ms = int(times_ms[-1])

    avg_total_kg = float(np.mean(hold_total)) if len(hold_total) else 0.0
    tut_s = _duration_above_threshold_s(times_ms, total, config.tut_threshold_kg)

    # Distribution drift per second during hold
    if len(hold_times) >= 2:
        _, hold_shift_series = _load_shift_rate_series(hold_times, pct_hold)
        distribution_drift = float(np.mean(hold_shift_series)) if len(hold_shift_series) else 0.0
    else:
        distribution_drift = 0.0

    steadiness_total = float(np.std(hold_total)) if len(hold_total) else 0.0
    steadiness_finger = (
        float(np.std(hold_fingers[:, 0])) if len(hold_fingers) else 0.0,
        float(np.std(hold_fingers[:, 1])) if len(hold_fingers) else 0.0,
        float(np.std(hold_fingers[:, 2])) if len(hold_fingers) else 0.0,
        float(np.std(hold_fingers[:, 3])) if len(hold_fingers) else 0.0,
    )

    # Imbalance index = mean stddev over finger percentages (percentage points)
    imbalance = float(np.mean(np.std(pct_hold * 100.0, axis=1))) if len(pct_hold) else 0.0

    # Load variation CV = avg CV over fingers during hold
    cvs = []
    for i in range(4):
        ch = hold_fingers[:, i] if len(hold_fingers) else np.array([], dtype=float)
        if len(ch) == 0:
            cvs.append(0.0)
            continue
        mean_abs = float(np.mean(np.abs(ch)))
        if mean_abs < 1e-9:
            cvs.append(0.0)
        else:
            cvs.append(float(np.std(ch) / mean_abs))
    load_variation_cv = float(np.mean(cvs)) if cvs else 0.0

    dom_idx = np.argmax(pct_all, axis=1) if len(pct_all) else np.array([], dtype=int)
    switch_count = int(np.sum(dom_idx[1:] != dom_idx[:-1])) if len(dom_idx) > 1 else 0

    _, shift_series = _load_shift_rate_series(times_ms, pct_all)
    load_shift_rate = float(np.mean(shift_series)) if len(shift_series) else 0.0

    stabilization_time = _stabilization_time_s(
        times_ms,
        pct_all,
        start_t_ms,
        threshold=config.stabilization_shift_threshold,
        hold_ms=config.stabilization_hold_ms,
    )

    valid_hold = hold_total > 1e-9
    if np.any(valid_hold):
        ring_pinky_share = float(np.mean((hold_fingers[valid_hold, 2] + hold_fingers[valid_hold, 3]) / hold_total[valid_hold]))
    else:
        ring_pinky_share = 0.0

    rel_t = [int(t - start_t_ms) for t in times_ms]
    detail_total = [float(v) for v in total]
    detail_fingers = [tuple(float(v) for v in row) for row in fingers]
    detail_pct = [tuple(float(v * 100.0) for v in row) for row in pct_all]

    return EffortMetrics(
        effort_id=effort_id,
        start_t_ms=start_t_ms,
        end_t_ms=end_t_ms,
        duration_s=duration_s,
        peak_total_kg=peak_total,
        peak_per_finger_kg=peak_fingers,
        time_to_peak_s=time_to_peak_s,
        rfd_100_kg_s=rfd_100,
        rfd_200_kg_s=rfd_200,
        rfd_100_n_s=rfd_100 * KG_TO_N,
        rfd_200_n_s=rfd_200 * KG_TO_N,
        avg_total_kg=avg_total_kg,
        tut_s=tut_s,
        distribution_drift_per_s=distribution_drift,
        steadiness_total_kg=steadiness_total,
        steadiness_per_finger_kg=steadiness_finger,
        finger_imbalance_index=imbalance,
        load_variation_cv=load_variation_cv,
        dominant_switch_count=switch_count,
        load_shift_rate=load_shift_rate,
        stabilization_time_s=stabilization_time,
        ring_pinky_share=ring_pinky_share,
        hold_start_t_ms=hold_start_t_ms,
        hold_end_t_ms=hold_end_t_ms,
        detail_t_ms=rel_t,
        detail_total_kg=detail_total,
        detail_finger_kg=detail_fingers,
        detail_finger_pct=detail_pct,
    )
