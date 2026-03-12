from analytics.metrics import AnalysisConfig, analyze_effort_samples
from analytics.models import ForceSample


def _sample(t_ms: int, total: float) -> ForceSample:
    per = total / 4.0
    return ForceSample(t_ms=t_ms, raw=(per, per, per, per), kg=(per, per, per, per))


def test_rfd_with_low_sample_rate_interpolation() -> None:
    # 10 Hz samples (100 ms). Linear ramp with slope 20 kg/s for first 400 ms.
    times = [0, 100, 200, 300, 400, 500, 600]
    totals = [0.0, 2.0, 4.0, 6.0, 8.0, 8.0, 8.0]
    effort = [_sample(t, v) for t, v in zip(times, totals)]

    m = analyze_effort_samples(effort, effort_id=1, config=AnalysisConfig())

    assert 18.0 <= m.rfd_100_kg_s <= 22.0
    assert 18.0 <= m.rfd_200_kg_s <= 22.0
    assert m.rfd_100_n_s > m.rfd_100_kg_s
