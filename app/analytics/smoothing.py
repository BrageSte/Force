from __future__ import annotations

from collections import deque
from enum import Enum


class SmoothingMode(str, Enum):
    NONE = "NONE"
    EMA = "EMA"
    MOVING_AVG = "MOVING_AVG"


class MultiChannelSmoother:
    """Applies smoothing independently per finger channel."""

    def __init__(self, mode: SmoothingMode = SmoothingMode.EMA, ema_alpha: float = 0.25, window: int = 5):
        self.mode = mode
        self.ema_alpha = max(0.01, min(0.99, float(ema_alpha)))
        self.window = max(1, int(window))

        self._ema_state: list[float | None] = [None, None, None, None]
        self._ma_buf = [deque(maxlen=self.window) for _ in range(4)]

    def reset(self) -> None:
        self._ema_state = [None, None, None, None]
        self._ma_buf = [deque(maxlen=self.window) for _ in range(4)]

    def reconfigure(self, mode: SmoothingMode, ema_alpha: float, window: int) -> None:
        self.mode = mode
        self.ema_alpha = max(0.01, min(0.99, float(ema_alpha)))
        self.window = max(1, int(window))
        self.reset()

    def apply(self, values: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
        if self.mode == SmoothingMode.NONE:
            return values

        if self.mode == SmoothingMode.EMA:
            out: list[float] = []
            for i, value in enumerate(values):
                prev = self._ema_state[i]
                if prev is None:
                    self._ema_state[i] = float(value)
                else:
                    self._ema_state[i] = (self.ema_alpha * float(value)) + ((1.0 - self.ema_alpha) * prev)
                out.append(self._ema_state[i] if self._ema_state[i] is not None else float(value))
            return tuple(out)  # type: ignore[return-value]

        # Moving average
        out_ma: list[float] = []
        for i, value in enumerate(values):
            self._ma_buf[i].append(float(value))
            out_ma.append(sum(self._ma_buf[i]) / max(1, len(self._ma_buf[i])))
        return tuple(out_ma)  # type: ignore[return-value]
