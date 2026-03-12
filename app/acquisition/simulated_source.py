from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass

from PySide6.QtCore import QTimer

from .base import AcquisitionSample, DataSource


@dataclass(slots=True)
class _Profile:
    kind: str
    ramp_ms: int
    hold_ms: int
    release_ms: int
    peak_total_kg: float
    finger_share: tuple[float, float, float, float]


class SimulatedDataSource(DataSource):
    """Generates realistic max-pull and hang-like force profiles for development/testing."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._timer = QTimer(self)
        self._timer.setInterval(20)  # ~50 Hz
        self._timer.timeout.connect(self._tick)

        self._running = False
        self._start_wall_ms = 0
        self._last_emit_ms = 0

        self._current_profile: _Profile | None = None
        self._profile_start_ms = 0
        self._next_auto_trigger_ms = 2500

        self._output_kg = True
        self._raw_offset = [100_000.0, 105_000.0, 97_000.0, 102_000.0]
        self._raw_scale = [1e-5, 1e-5, 1e-5, 1e-5]

    def set_output_kg(self, enabled: bool) -> None:
        self._output_kg = enabled

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._start_wall_ms = int(time.monotonic() * 1000)
        self._last_emit_ms = 0
        self._next_auto_trigger_ms = 1500
        self._current_profile = None
        self._timer.start()
        self.connection_changed.emit(True)
        self.status_message.emit("Simulator connected")

    def stop(self) -> None:
        if not self._running:
            return
        self._running = False
        self._timer.stop()
        self.connection_changed.emit(False)
        self.status_message.emit("Simulator disconnected")

    def is_running(self) -> bool:
        return self._running

    def trigger_max_pull(self) -> None:
        self._current_profile = self._make_max_pull_profile()
        self._profile_start_ms = self._elapsed_ms()
        self.status_message.emit("Simulator: max pull triggered")

    def trigger_hang(self) -> None:
        self._current_profile = self._make_hang_profile()
        self._profile_start_ms = self._elapsed_ms()
        self.status_message.emit("Simulator: hang triggered")

    def _elapsed_ms(self) -> int:
        return int(time.monotonic() * 1000) - self._start_wall_ms

    def _tick(self) -> None:
        if not self._running:
            return

        t_ms = self._elapsed_ms()
        if t_ms <= self._last_emit_ms:
            t_ms = self._last_emit_ms + self._timer.interval()
        self._last_emit_ms = t_ms

        if self._current_profile is None and t_ms >= self._next_auto_trigger_ms:
            self._current_profile = self._make_random_profile()
            self._profile_start_ms = t_ms

        kg = self._sample_kg(t_ms)
        values = kg
        if not self._output_kg:
            values = tuple(
                self._raw_offset[i] + (kg[i] / self._raw_scale[i])
                for i in range(4)
            )

        self.sample_received.emit(AcquisitionSample(t_ms=t_ms, values=values))

    def _sample_kg(self, t_ms: int) -> tuple[float, float, float, float]:
        noise = [random.gauss(0.0, 0.03) for _ in range(4)]

        if self._current_profile is None:
            return tuple(noise)  # idle drift

        p = self._current_profile
        e = t_ms - self._profile_start_ms
        total_dur = p.ramp_ms + p.hold_ms + p.release_ms

        if e < 0:
            return tuple(noise)
        if e >= total_dur:
            self._current_profile = None
            self._next_auto_trigger_ms = t_ms + random.randint(2500, 8000)
            return tuple(noise)

        if e < p.ramp_ms:
            gain = e / max(1, p.ramp_ms)
        elif e < p.ramp_ms + p.hold_ms:
            gain = 1.0
        else:
            release_e = e - (p.ramp_ms + p.hold_ms)
            gain = max(0.0, 1.0 - (release_e / max(1, p.release_ms)))

        # small distribution drift over time to mimic real shifts
        drift = 0.04 * math.sin(e / 350.0)
        raw_share = [
            max(0.02, p.finger_share[0] + drift),
            max(0.02, p.finger_share[1] - drift * 0.6),
            max(0.02, p.finger_share[2] - drift * 0.2),
            max(0.02, p.finger_share[3] - drift * 0.2),
        ]
        share_sum = sum(raw_share)
        share = [s / share_sum for s in raw_share]

        total_kg = p.peak_total_kg * gain
        finger = [total_kg * share[i] + noise[i] for i in range(4)]
        return tuple(finger)

    def _make_random_profile(self) -> _Profile:
        if random.random() < 0.55:
            return self._make_max_pull_profile()
        return self._make_hang_profile()

    @staticmethod
    def _random_share() -> tuple[float, float, float, float]:
        base = [
            random.uniform(0.20, 0.34),
            random.uniform(0.20, 0.34),
            random.uniform(0.16, 0.28),
            random.uniform(0.10, 0.23),
        ]
        s = sum(base)
        return tuple(b / s for b in base)

    def _make_max_pull_profile(self) -> _Profile:
        return _Profile(
            kind="max_pull",
            ramp_ms=random.randint(350, 850),
            hold_ms=random.randint(120, 450),
            release_ms=random.randint(500, 1000),
            peak_total_kg=random.uniform(14.0, 42.0),
            finger_share=self._random_share(),
        )

    def _make_hang_profile(self) -> _Profile:
        return _Profile(
            kind="hang",
            ramp_ms=random.randint(600, 1300),
            hold_ms=random.randint(3000, 9000),
            release_ms=random.randint(800, 1800),
            peak_total_kg=random.uniform(10.0, 28.0),
            finger_share=self._random_share(),
        )
