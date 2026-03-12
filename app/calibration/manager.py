from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class CalibrationProfile:
    """Per-finger offset/scale calibration used for MODE_RAW."""

    offsets: list[float] = field(default_factory=lambda: [0.0, 0.0, 0.0, 0.0])
    scales: list[float] = field(default_factory=lambda: [1e-5, 1e-5, 1e-5, 1e-5])

    def raw_to_kg(self, raw: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
        out = []
        for i in range(4):
            out.append((float(raw[i]) - float(self.offsets[i])) * float(self.scales[i]))
        return tuple(out)  # type: ignore[return-value]

    def tare_all(self, raw: tuple[float, float, float, float]) -> None:
        for i in range(4):
            self.offsets[i] = float(raw[i])

    def tare_finger(self, finger_idx: int, raw_value: float) -> None:
        self.offsets[finger_idx] = float(raw_value)

    def calibrate_finger(self, finger_idx: int, tare_raw: float, loaded_raw: float, known_kg: float) -> float:
        delta = float(loaded_raw) - float(tare_raw)
        if abs(delta) < 1e-9:
            raise ValueError("Delta too small; check load and wiring")
        if abs(known_kg) < 1e-9:
            raise ValueError("Known kg must be non-zero")

        self.offsets[finger_idx] = float(tare_raw)
        self.scales[finger_idx] = float(known_kg) / delta
        return self.scales[finger_idx]

    def to_dict(self) -> dict:
        return {
            "offsets": [float(v) for v in self.offsets],
            "scales": [float(v) for v in self.scales],
        }

    @classmethod
    def from_dict(cls, data: dict | None) -> "CalibrationProfile":
        if not data:
            return cls()
        offsets = data.get("offsets", [0.0, 0.0, 0.0, 0.0])
        scales = data.get("scales", [1e-5, 1e-5, 1e-5, 1e-5])
        if len(offsets) != 4 or len(scales) != 4:
            return cls()
        return cls(
            offsets=[float(v) for v in offsets],
            scales=[float(v) for v in scales],
        )
