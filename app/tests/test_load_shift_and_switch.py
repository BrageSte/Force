from analytics.metrics import AnalysisConfig, analyze_effort_samples
from analytics.models import ForceSample


def test_load_shift_rate_and_dominant_switch_count() -> None:
    samples: list[ForceSample] = []
    t = 0
    # First phase: index dominant
    for _ in range(6):
        kg = (4.0, 3.0, 2.0, 1.0)
        samples.append(ForceSample(t_ms=t, raw=kg, kg=kg))
        t += 100
    # Second phase: middle dominant
    for _ in range(6):
        kg = (2.0, 5.0, 2.0, 1.0)
        samples.append(ForceSample(t_ms=t, raw=kg, kg=kg))
        t += 100

    m = analyze_effort_samples(samples, effort_id=1, config=AnalysisConfig())

    assert m.dominant_switch_count == 1
    assert m.load_shift_rate > 0.0
    assert m.stabilization_time_s is not None
