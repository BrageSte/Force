from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path

from analytics.metrics import AnalysisConfig
from analytics.segmentation import SegmenterConfig


class InputMode(str, Enum):
    MODE_KG_DIRECT = "MODE_KG_DIRECT"
    MODE_RAW = "MODE_RAW"


class UnitsMode(str, Enum):
    KG = "kg"
    N = "N"


@dataclass(slots=True)
class AppSettings:
    input_mode: InputMode = InputMode.MODE_KG_DIRECT
    units: UnitsMode = UnitsMode.KG
    show_newton_in_analytics: bool = True
    preferred_source: str = "Serial"
    ui_theme: str = "light_clean"

    hand_default: str = "Right"

    smoothing_mode: str = "EMA"  # NONE / EMA / MOVING_AVG
    smoothing_alpha: float = 0.25
    smoothing_window: int = 5

    ring_buffer_seconds: int = 45

    start_threshold_kg: float = 0.5
    stop_threshold_kg: float = 0.2
    start_hold_ms: int = 150
    stop_hold_ms: int = 300

    tut_threshold_kg: float = 0.5
    hold_peak_fraction: float = 0.9
    stabilization_shift_threshold: float = 0.8
    stabilization_hold_ms: int = 250

    default_port: str = ""
    default_baud: int = 115200
    ble_device_id: str = ""
    ble_rx_uuid: str = ""
    ble_tx_uuid: str = ""

    calibration: dict = field(default_factory=dict)

    def segmenter_config(self) -> SegmenterConfig:
        return SegmenterConfig(
            start_threshold_kg=self.start_threshold_kg,
            stop_threshold_kg=self.stop_threshold_kg,
            start_hold_ms=self.start_hold_ms,
            stop_hold_ms=self.stop_hold_ms,
        )

    def analysis_config(self) -> AnalysisConfig:
        return AnalysisConfig(
            tut_threshold_kg=self.tut_threshold_kg,
            hold_peak_fraction=self.hold_peak_fraction,
            stabilization_shift_threshold=self.stabilization_shift_threshold,
            stabilization_hold_ms=self.stabilization_hold_ms,
        )

    def to_dict(self) -> dict:
        d = asdict(self)
        d["input_mode"] = self.input_mode.value
        d["units"] = self.units.value
        return d

    @classmethod
    def from_dict(cls, data: dict | None) -> "AppSettings":
        if not data:
            return cls()

        out = cls()
        for key, value in data.items():
            if not hasattr(out, key):
                continue
            setattr(out, key, value)

        input_mode_raw = data.get("input_mode", InputMode.MODE_KG_DIRECT.value)
        units_raw = data.get("units", UnitsMode.KG.value)
        try:
            out.input_mode = InputMode(str(input_mode_raw))
        except Exception:
            out.input_mode = InputMode.MODE_KG_DIRECT

        try:
            out.units = UnitsMode(str(units_raw))
        except Exception:
            out.units = UnitsMode.KG

        if out.preferred_source not in ("Serial", "Simulator", "BLE_UART"):
            out.preferred_source = "Serial"
        if out.ui_theme != "light_clean":
            out.ui_theme = "light_clean"
        try:
            out.default_baud = int(out.default_baud)
        except Exception:
            out.default_baud = 115200

        return out


class SettingsStore:
    def __init__(self, path: Path):
        self.path = path

    def load(self) -> AppSettings:
        if not self.path.exists():
            return AppSettings()
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return AppSettings()
        return AppSettings.from_dict(data)

    def save(self, settings: AppSettings) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(settings.to_dict(), indent=2, ensure_ascii=True),
            encoding="utf-8",
        )
