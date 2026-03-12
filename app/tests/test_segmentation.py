from analytics.models import ForceSample
from analytics.segmentation import SegmenterConfig, segment_efforts


def _sample(t_ms: int, total: float) -> ForceSample:
    per = total / 4.0
    return ForceSample(
        t_ms=t_ms,
        raw=(per, per, per, per),
        kg=(per, per, per, per),
    )


def test_segment_efforts_two_efforts() -> None:
    totals = [
        0.0,
        0.6,
        0.8,
        1.0,
        0.9,
        0.4,
        0.1,
        0.1,
        0.1,
        0.0,
        0.0,
        0.7,
        0.9,
        1.1,
        0.4,
        0.1,
        0.1,
        0.1,
        0.0,
    ]
    samples = [_sample(i * 100, v) for i, v in enumerate(totals)]

    cfg = SegmenterConfig(start_threshold_kg=0.5, stop_threshold_kg=0.2, start_hold_ms=150, stop_hold_ms=300)
    segments = segment_efforts(samples, cfg)

    assert len(segments) == 2
    assert segments[0][0] < segments[0][1]
    assert segments[1][0] < segments[1][1]
    assert segments[1][0] > segments[0][1]
