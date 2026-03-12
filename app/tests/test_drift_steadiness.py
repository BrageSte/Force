from analytics.metrics import AnalysisConfig, analyze_effort_samples
from analytics.models import ForceSample


def _stable_samples() -> list[ForceSample]:
    out = []
    for i in range(25):
        t = i * 100
        kg = (3.0, 3.0, 2.5, 1.5)
        out.append(ForceSample(t_ms=t, raw=kg, kg=kg))
    return out


def _drifty_samples() -> list[ForceSample]:
    out = []
    for i in range(25):
        t = i * 100
        idx = 2.0 + i * 0.06
        mid = 3.8 - i * 0.04
        ring = 2.1 + ((-1) ** i) * 0.15
        pinky = 1.4 + (i * 0.02)
        kg = (idx, mid, ring, pinky)
        out.append(ForceSample(t_ms=t, raw=kg, kg=kg))
    return out


def test_distribution_drift_and_steadiness_detected() -> None:
    cfg = AnalysisConfig()

    stable = analyze_effort_samples(_stable_samples(), effort_id=1, config=cfg)
    drifty = analyze_effort_samples(_drifty_samples(), effort_id=2, config=cfg)

    assert drifty.distribution_drift_per_s > stable.distribution_drift_per_s
    assert drifty.steadiness_total_kg >= stable.steadiness_total_kg
    assert drifty.load_variation_cv > stable.load_variation_cv
