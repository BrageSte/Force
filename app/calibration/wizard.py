from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .manager import CalibrationProfile


class WizardStep(str, Enum):
    IDLE = "IDLE"
    TARE_CAPTURED = "TARE_CAPTURED"


@dataclass(slots=True)
class CalibrationWizard:
    finger_idx: int = 0
    step: WizardStep = WizardStep.IDLE
    tare_raw: float = 0.0

    def start(self, finger_idx: int) -> None:
        self.finger_idx = finger_idx
        self.step = WizardStep.IDLE
        self.tare_raw = 0.0

    def capture_tare(self, raw_value: float) -> None:
        self.tare_raw = float(raw_value)
        self.step = WizardStep.TARE_CAPTURED

    def complete(self, profile: CalibrationProfile, loaded_raw: float, known_kg: float) -> float:
        if self.step != WizardStep.TARE_CAPTURED:
            raise ValueError("Capture tare first")
        scale = profile.calibrate_finger(self.finger_idx, self.tare_raw, loaded_raw, known_kg)
        self.step = WizardStep.IDLE
        return scale
