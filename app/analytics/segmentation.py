from __future__ import annotations

from dataclasses import dataclass

from .models import ForceSample


@dataclass(slots=True)
class SegmenterConfig:
    start_threshold_kg: float = 0.5
    stop_threshold_kg: float = 0.2
    start_hold_ms: int = 150
    stop_hold_ms: int = 300


@dataclass(slots=True)
class EffortEvent:
    started: bool = False
    ended: bool = False
    start_index: int | None = None
    end_index: int | None = None
    active: bool = False


class OnlineEffortDetector:
    """State machine for live effort segmentation."""

    def __init__(self, config: SegmenterConfig):
        self.config = config
        self._active = False
        self._above_since_ms: int | None = None
        self._below_since_ms: int | None = None
        self._candidate_start_index: int | None = None
        self._current_start_index: int | None = None

    def reset(self) -> None:
        self._active = False
        self._above_since_ms = None
        self._below_since_ms = None
        self._candidate_start_index = None
        self._current_start_index = None

    def force_end_current(self) -> None:
        self._active = False
        self._below_since_ms = None

    @property
    def active(self) -> bool:
        return self._active

    def update(self, sample_index: int, t_ms: int, total_kg: float) -> EffortEvent:
        event = EffortEvent(active=self._active)

        if not self._active:
            if total_kg > self.config.start_threshold_kg:
                if self._above_since_ms is None:
                    self._above_since_ms = t_ms
                    self._candidate_start_index = sample_index
                elif (t_ms - self._above_since_ms) >= self.config.start_hold_ms:
                    self._active = True
                    self._current_start_index = self._candidate_start_index
                    self._below_since_ms = None
                    event.started = True
                    event.start_index = self._current_start_index
                    self._above_since_ms = None
                    self._candidate_start_index = None
            else:
                self._above_since_ms = None
                self._candidate_start_index = None

        else:
            if total_kg < self.config.stop_threshold_kg:
                if self._below_since_ms is None:
                    self._below_since_ms = t_ms
                elif (t_ms - self._below_since_ms) >= self.config.stop_hold_ms:
                    event.ended = True
                    event.start_index = self._current_start_index
                    event.end_index = sample_index
                    self._active = False
                    self._below_since_ms = None
                    self._current_start_index = None
            else:
                self._below_since_ms = None

        event.active = self._active
        return event


def segment_efforts(samples: list[ForceSample], config: SegmenterConfig) -> list[tuple[int, int]]:
    """Offline segmentation returning index ranges [start_idx, end_idx]."""

    det = OnlineEffortDetector(config)
    segments: list[tuple[int, int]] = []

    for i, sample in enumerate(samples):
        evt = det.update(i, sample.t_ms, sample.total_kg)
        if evt.ended and evt.start_index is not None and evt.end_index is not None:
            if evt.end_index > evt.start_index:
                segments.append((evt.start_index, evt.end_index))

    if det.active and segments:
        # leave open effort out for v1 stability
        pass
    elif det.active and len(samples) >= 2:
        # session ended during effort; close at last sample
        start_idx = det._current_start_index if det._current_start_index is not None else 0
        end_idx = len(samples) - 1
        if end_idx > start_idx:
            segments.append((start_idx, end_idx))

    return segments
