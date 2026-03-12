from __future__ import annotations

from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

import numpy as np
from PySide6.QtCore import QObject, Signal

from acquisition import AcquisitionSample, SerialDataSource, SimulatedDataSource
from analytics import (
    AnalysisConfig,
    EffortMetrics,
    ForceSample,
    MultiChannelSmoother,
    OnlineEffortDetector,
    SegmenterConfig,
    SmoothingMode,
    analyze_effort_samples,
    analyze_session,
)
from calibration import CalibrationProfile
from persistence import AppSettings, InputMode, SessionMeta, SessionStore, SettingsStore
from ui.constants import FINGER_NAMES

SourceKind = Literal["Serial", "Simulator", "BLE_UART"]


class AppController(QObject):
    """Application viewmodel/controller shared across all tabs."""

    live_updated = Signal(object)
    effort_completed = Signal(object)
    test_result_ready = Signal(object)
    session_analysis_updated = Signal(object, object)  # efforts, summary
    history_updated = Signal(object)
    status_message = Signal(str)
    connection_changed = Signal(bool)
    recording_changed = Signal(bool)
    settings_changed = Signal(object)
    calibration_changed = Signal(object)

    def __init__(self, app_dir: Path, parent=None):
        super().__init__(parent)
        self.app_dir = app_dir

        self.settings_store = SettingsStore(self.app_dir / "data" / "settings.json")
        self.settings = self.settings_store.load()

        self.calibration = CalibrationProfile.from_dict(self.settings.calibration)
        self.session_store = SessionStore(self.app_dir / "data" / "sessions")

        self._smoother = MultiChannelSmoother(
            mode=SmoothingMode(self.settings.smoothing_mode),
            ema_alpha=self.settings.smoothing_alpha,
            window=self.settings.smoothing_window,
        )

        self._segment_cfg = self.settings.segmenter_config()
        self._analysis_cfg = self.settings.analysis_config()
        self._detector = OnlineEffortDetector(self._segment_cfg)

        self.hand = self.settings.hand_default if self.settings.hand_default in ("Right", "Left") else "Right"

        self._source: SerialDataSource | SimulatedDataSource | None = None
        preferred = self.settings.preferred_source
        self._source_kind: SourceKind = preferred if preferred in ("Serial", "Simulator", "BLE_UART") else "Serial"

        self._sample_counter = 0
        self._last_raw: tuple[float, float, float, float] | None = None

        self._live_buffer: deque[ForceSample] = deque()
        self._live_window_ms = int(max(15, self.settings.ring_buffer_seconds) * 1000)

        self._recording = False
        self._recorded_samples: list[ForceSample] = []
        self._recorded_efforts: list[EffortMetrics] = []
        self._recording_started_iso: str | None = None

        self._current_effort_samples: list[ForceSample] = []
        self._current_effort_metrics: EffortMetrics | None = None
        self._last_effort_metrics: EffortMetrics | None = None

        self._armed_test: str | None = None
        self._test_auto_recording = False
        self._raw_autoswitch_done = False

        self.history_updated.emit(self.session_store.list_sessions())

    # ----- Source connection -----

    @property
    def source_kind(self) -> str:
        return self._source_kind

    @property
    def is_connected(self) -> bool:
        return self._source is not None and self._source.is_running()

    @property
    def is_recording(self) -> bool:
        return self._recording

    @staticmethod
    def available_ports() -> list[str]:
        return SerialDataSource.list_ports()

    def connect_source(self, source_kind: SourceKind, port: str = "", baud: int = 115200) -> None:
        self.disconnect_source()
        self._raw_autoswitch_done = False

        if source_kind not in ("Serial", "Simulator", "BLE_UART"):
            self.status_message.emit(f"Unsupported source: {source_kind}")
            self.connection_changed.emit(False)
            return

        self._source_kind = source_kind
        self.settings.preferred_source = source_kind
        if port:
            self.settings.default_port = port
        self.settings.default_baud = int(baud)
        self.settings_store.save(self.settings)

        if source_kind == "Serial":
            target_port = port or self.settings.default_port
            src = SerialDataSource(port=target_port, baud=baud)
        elif source_kind == "Simulator":
            src = SimulatedDataSource()
            src.set_output_kg(self.settings.input_mode == InputMode.MODE_KG_DIRECT)
        else:
            if not self.settings.ble_device_id or not self.settings.ble_rx_uuid:
                self.status_message.emit(
                    "BLE_UART not configured. Add BLE Device ID + RX UUID in Settings."
                )
            else:
                self.status_message.emit(
                    "BLE_UART is configured, but runtime BLE transport is not implemented yet."
                )
            self.connection_changed.emit(False)
            return

        src.sample_received.connect(self._on_acquisition_sample)
        src.status_message.connect(self.status_message.emit)
        src.connection_changed.connect(self.connection_changed.emit)
        self._source = src
        src.start()

    def disconnect_source(self) -> None:
        if self._source is not None:
            try:
                self._source.stop()
            except Exception:
                pass
        self._source = None
        self.connection_changed.emit(False)

    def send_source_command(self, cmd: str) -> None:
        if self._source is not None:
            self._source.send_command(cmd)

    # ----- Session control -----

    def start_recording(self) -> None:
        self._recording = True
        self._test_auto_recording = False
        self._recorded_samples = []
        self._recorded_efforts = []
        self._recording_started_iso = datetime.utcnow().isoformat(timespec="seconds")
        self._detector.reset()
        self._current_effort_samples = []
        self._current_effort_metrics = None
        self._last_effort_metrics = None
        self._sample_counter = 0
        self.status_message.emit("Recording started")
        self.recording_changed.emit(True)

    def stop_recording(self, tag: str = "", notes: str = "") -> dict[str, Any] | None:
        if not self._recording:
            return None

        if len(self._current_effort_samples) >= 2:
            self._finalize_current_effort(force=True)

        self._recording = False
        self._test_auto_recording = False
        self.recording_changed.emit(False)

        session_id = datetime.utcnow().strftime("session_%Y%m%d_%H%M%S")
        started_at = self._recording_started_iso or datetime.utcnow().isoformat(timespec="seconds")
        ended_at = datetime.utcnow().isoformat(timespec="seconds")

        efforts, summary = analyze_session(
            self._recorded_samples,
            hand=self.hand,
            segment_cfg=self._segment_cfg,
            analysis_cfg=self._analysis_cfg,
            session_id=session_id,
            started_at_iso=started_at,
            ended_at_iso=ended_at,
        )
        self._recorded_efforts = efforts

        payload: dict[str, Any] = {
            "session_id": session_id,
            "started_at_iso": started_at,
            "ended_at_iso": ended_at,
            "hand": self.hand,
            "tag": tag,
            "notes": notes,
            "settings": self.settings.to_dict(),
            "summary": summary.to_dict(),
            "efforts": [e.to_dict() for e in efforts],
            "samples": [
                {
                    "t_ms": s.t_ms,
                    "raw": list(s.raw),
                    "kg": list(s.kg),
                    "total_kg": s.total_kg,
                }
                for s in self._recorded_samples
            ],
        }

        self.session_store.save_session(payload)
        self.status_message.emit(f"Recording stopped. Saved {session_id}")
        self.session_analysis_updated.emit(efforts, summary)
        self.history_updated.emit(self.session_store.list_sessions())
        return payload

    def reset_session(self, clear_live_buffer: bool = True) -> None:
        self._detector.reset()
        self._current_effort_samples = []
        self._current_effort_metrics = None
        self._last_effort_metrics = None
        self._recorded_efforts = []
        if self._recording:
            self._recorded_samples = []
            self._recording_started_iso = datetime.utcnow().isoformat(timespec="seconds")
        if clear_live_buffer:
            self._live_buffer.clear()
        self.status_message.emit("Session reset")
        self._emit_live_update()

    def reset_effort(self) -> None:
        self._current_effort_samples = []
        self._current_effort_metrics = None
        self._detector.force_end_current()
        self.status_message.emit("Current effort reset")
        self._emit_live_update()

    # ----- Tests -----

    def start_test(self, test_kind: str) -> None:
        self._armed_test = test_kind
        if not self._recording:
            self.start_recording()
            self._test_auto_recording = True
        self.status_message.emit(f"Test armed: {test_kind}")
        if isinstance(self._source, SimulatedDataSource):
            if test_kind == "max_pull":
                self._source.trigger_max_pull()
            else:
                self._source.trigger_hang()

    # ----- Settings / calibration -----

    def set_hand(self, hand: str) -> None:
        if hand not in ("Right", "Left"):
            return
        self.hand = hand
        self.settings.hand_default = hand
        self.settings_store.save(self.settings)
        self.settings_changed.emit(self.settings)
        self._emit_live_update()

    def set_input_mode(self, mode: InputMode) -> None:
        self.settings.input_mode = mode
        self._raw_autoswitch_done = False
        self.settings_store.save(self.settings)
        if isinstance(self._source, SimulatedDataSource):
            self._source.set_output_kg(mode == InputMode.MODE_KG_DIRECT)
        self.status_message.emit(f"Input mode: {mode.value}")
        self.settings_changed.emit(self.settings)

    def update_settings(self, new_values: dict[str, Any]) -> None:
        for key, value in new_values.items():
            if not hasattr(self.settings, key):
                continue
            setattr(self.settings, key, value)

        if self.settings.preferred_source not in ("Serial", "Simulator", "BLE_UART"):
            self.settings.preferred_source = "Serial"
        if self.settings.ui_theme != "light_clean":
            self.settings.ui_theme = "light_clean"

        # Rebuild runtime configs
        self._segment_cfg = self.settings.segmenter_config()
        self._analysis_cfg = self.settings.analysis_config()
        self._detector = OnlineEffortDetector(self._segment_cfg)
        self._live_window_ms = int(max(15, self.settings.ring_buffer_seconds) * 1000)

        try:
            mode = SmoothingMode(self.settings.smoothing_mode)
        except Exception:
            mode = SmoothingMode.EMA
            self.settings.smoothing_mode = mode.value

        self._smoother.reconfigure(
            mode=mode,
            ema_alpha=self.settings.smoothing_alpha,
            window=self.settings.smoothing_window,
        )

        self.settings.calibration = self.calibration.to_dict()
        self.settings_store.save(self.settings)
        self.settings_changed.emit(self.settings)
        self.status_message.emit("Settings updated")

    def tare_all(self) -> None:
        if self._last_raw is None:
            self.status_message.emit("No sample yet for tare")
            return
        self.calibration.tare_all(self._last_raw)
        self.settings.calibration = self.calibration.to_dict()
        self.settings_store.save(self.settings)
        self.calibration_changed.emit(self.calibration)
        self.status_message.emit("App tare all complete")

    def tare_finger(self, finger_idx: int) -> None:
        if self._last_raw is None:
            self.status_message.emit("No sample yet for tare")
            return
        self.calibration.tare_finger(finger_idx, self._last_raw[finger_idx])
        self.settings.calibration = self.calibration.to_dict()
        self.settings_store.save(self.settings)
        self.calibration_changed.emit(self.calibration)
        self.status_message.emit(f"App tare finger: {FINGER_NAMES[finger_idx]}")

    def calibrate_finger_from_window(
        self,
        finger_idx: int,
        known_kg: float,
        tare_window_s: float = 2.0,
        load_window_s: float = 2.0,
    ) -> float:
        tare_raw = self.recent_raw_median(finger_idx, window_s=tare_window_s)
        if tare_raw is None:
            raise ValueError("No tare sample available")
        loaded_raw = self.recent_raw_median(finger_idx, window_s=load_window_s)
        if loaded_raw is None:
            raise ValueError("No load sample available")

        scale = self.calibration.calibrate_finger(finger_idx, tare_raw, loaded_raw, known_kg)
        self.settings.calibration = self.calibration.to_dict()
        self.settings_store.save(self.settings)
        self.calibration_changed.emit(self.calibration)
        self.status_message.emit(f"Finger calibrated: {FINGER_NAMES[finger_idx]} scale={scale:.8f}")
        return scale

    def calibrate_finger_with_values(
        self,
        finger_idx: int,
        tare_raw: float,
        loaded_raw: float,
        known_kg: float,
    ) -> float:
        scale = self.calibration.calibrate_finger(
            finger_idx=finger_idx,
            tare_raw=tare_raw,
            loaded_raw=loaded_raw,
            known_kg=known_kg,
        )
        self.settings.calibration = self.calibration.to_dict()
        self.settings_store.save(self.settings)
        self.calibration_changed.emit(self.calibration)
        self.status_message.emit(f"Finger calibrated: {FINGER_NAMES[finger_idx]} scale={scale:.8f}")
        return scale

    def get_calibration(self) -> CalibrationProfile:
        return self.calibration

    def recent_raw_median(self, finger_idx: int, window_s: float = 2.0) -> float | None:
        if not self._live_buffer:
            return None
        end_ms = self._live_buffer[-1].t_ms
        start_ms = end_ms - int(max(0.1, window_s) * 1000)

        vals = [s.raw[finger_idx] for s in self._live_buffer if s.t_ms >= start_ms]
        if not vals:
            vals = [self._live_buffer[-1].raw[finger_idx]]
        return float(np.median(np.array(vals, dtype=float)))

    # ----- History -----

    def list_sessions(self) -> list[SessionMeta]:
        return self.session_store.list_sessions()

    def load_session(self, session_id: str) -> dict[str, Any]:
        return self.session_store.load_session(session_id)

    def compare_sessions(self, a: str, b: str) -> dict[str, float]:
        sa = self.load_session(a)
        sb = self.load_session(b)

        aa = sa.get("summary", {})
        bb = sb.get("summary", {})

        def _effort_agg(payload: dict[str, Any]) -> dict[str, float]:
            efforts = payload.get("efforts", [])
            if not efforts:
                return {
                    "avg_rfd100": 0.0,
                    "avg_imbalance": 0.0,
                    "avg_stabilization": 0.0,
                    "avg_switches": 0.0,
                }
            rfd = np.array([float(e.get("rfd_100_kg_s", 0.0)) for e in efforts], dtype=float)
            imb = np.array([float(e.get("finger_imbalance_index", 0.0)) for e in efforts], dtype=float)
            stab_vals = [float(e.get("stabilization_time_s", 0.0)) for e in efforts if e.get("stabilization_time_s") is not None]
            sw = np.array([float(e.get("dominant_switch_count", 0.0)) for e in efforts], dtype=float)
            return {
                "avg_rfd100": float(np.mean(rfd)) if len(rfd) else 0.0,
                "avg_imbalance": float(np.mean(imb)) if len(imb) else 0.0,
                "avg_stabilization": float(np.mean(stab_vals)) if stab_vals else 0.0,
                "avg_switches": float(np.mean(sw)) if len(sw) else 0.0,
            }

        a_agg = _effort_agg(sa)
        b_agg = _effort_agg(sb)

        return {
            "peak_total_diff_kg": float(bb.get("best_peak_kg", 0.0)) - float(aa.get("best_peak_kg", 0.0)),
            "avg_peak_diff_kg": float(bb.get("avg_peak_kg", 0.0)) - float(aa.get("avg_peak_kg", 0.0)),
            "fatigue_slope_diff": float(bb.get("fatigue_slope_kg_per_effort", 0.0))
            - float(aa.get("fatigue_slope_kg_per_effort", 0.0)),
            "rfd100_diff_kg_s": b_agg["avg_rfd100"] - a_agg["avg_rfd100"],
            "imbalance_diff": b_agg["avg_imbalance"] - a_agg["avg_imbalance"],
            "stabilization_diff_s": b_agg["avg_stabilization"] - a_agg["avg_stabilization"],
            "switch_diff": b_agg["avg_switches"] - a_agg["avg_switches"],
        }

    def export_efforts_csv(self, session_id: str) -> str:
        payload = self.load_session(session_id)
        out = self.session_store.export_efforts_csv(payload)
        self.status_message.emit(f"Exported CSV: {out}")
        return str(out)

    # ----- Internal sample handling -----

    def _on_acquisition_sample(self, sample: AcquisitionSample) -> None:
        self._sample_counter += 1
        self._last_raw = sample.values

        self._maybe_auto_switch_to_raw(sample.values)

        if self.settings.input_mode == InputMode.MODE_RAW:
            kg_values = self.calibration.raw_to_kg(sample.values)
        else:
            kg_values = sample.values

        kg_smoothed = self._smoother.apply(kg_values)
        force_sample = ForceSample(t_ms=sample.t_ms, raw=sample.values, kg=kg_smoothed)

        self._live_buffer.append(force_sample)
        self._prune_live_buffer()

        if self._recording:
            self._recorded_samples.append(force_sample)

        evt = self._detector.update(self._sample_counter, force_sample.t_ms, force_sample.total_kg)

        if evt.started:
            self._current_effort_samples = [force_sample]
        elif self._detector.active:
            self._current_effort_samples.append(force_sample)

        if self._detector.active and len(self._current_effort_samples) >= 3:
            self._current_effort_metrics = analyze_effort_samples(
                self._current_effort_samples,
                effort_id=0,
                config=self._analysis_cfg,
            )

        if evt.ended:
            self._finalize_current_effort(force=False)

        self._emit_live_update()

    def _maybe_auto_switch_to_raw(self, values: tuple[float, float, float, float]) -> None:
        if self.settings.input_mode != InputMode.MODE_KG_DIRECT:
            return
        if self._raw_autoswitch_done:
            return
        if self._source_kind not in ("Serial", "BLE_UART"):
            return

        max_abs = max(abs(float(v)) for v in values)
        if max_abs < 250.0:
            return

        self._raw_autoswitch_done = True
        self.settings.input_mode = InputMode.MODE_RAW
        self.settings_store.save(self.settings)
        self.settings_changed.emit(self.settings)
        self.status_message.emit(
            "Detected raw counts while MODE_KG_DIRECT was active. Switched to MODE_RAW automatically."
        )

    def _finalize_current_effort(self, force: bool) -> None:
        if len(self._current_effort_samples) < 2:
            self._current_effort_samples = []
            self._current_effort_metrics = None
            return

        effort_id = len(self._recorded_efforts) + 1
        metrics = analyze_effort_samples(
            self._current_effort_samples,
            effort_id=effort_id,
            config=self._analysis_cfg,
        )
        self._last_effort_metrics = metrics
        self._current_effort_metrics = None

        if self._recording:
            self._recorded_efforts.append(metrics)
            summary = {
                "efforts_count": len(self._recorded_efforts),
                "best_peak_kg": max((e.peak_total_kg for e in self._recorded_efforts), default=0.0),
            }
            self.session_analysis_updated.emit(self._recorded_efforts, summary)

        self.effort_completed.emit(metrics)
        if self._armed_test is not None:
            test_kind = self._armed_test
            self.test_result_ready.emit({"test_kind": test_kind, "metrics": metrics})
            self._armed_test = None
            if self._test_auto_recording:
                self.stop_recording(tag=f"test:{test_kind}", notes="Auto-saved from TEST tab")

        self._current_effort_samples = []

    def _prune_live_buffer(self) -> None:
        if not self._live_buffer:
            return
        cutoff = self._live_buffer[-1].t_ms - self._live_window_ms
        while len(self._live_buffer) > 2 and self._live_buffer[0].t_ms < cutoff:
            self._live_buffer.popleft()

    def _estimate_sample_rate(self) -> float:
        if len(self._live_buffer) < 2:
            return 0.0
        tail = list(self._live_buffer)[-30:]
        t0 = tail[0].t_ms
        t1 = tail[-1].t_ms
        if t1 <= t0:
            return 0.0
        return (len(tail) - 1) / ((t1 - t0) / 1000.0)

    def _emit_live_update(self) -> None:
        if not self._live_buffer:
            return

        first_t = self._live_buffer[0].t_ms
        t_s = [float(s.t_ms - first_t) / 1000.0 for s in self._live_buffer]
        finger_series = [[float(s.kg[i]) for s in self._live_buffer] for i in range(4)]
        total_series = [float(sum(s.kg)) for s in self._live_buffer]

        latest = self._live_buffer[-1]
        total_latest = latest.total_kg
        if total_latest > 1e-9:
            pct = tuple((latest.kg[i] / total_latest) * 100.0 for i in range(4))
        else:
            pct = (0.0, 0.0, 0.0, 0.0)

        payload = {
            "t_s": t_s,
            "finger_series_kg": finger_series,
            "total_series_kg": total_series,
            "latest_kg": latest.kg,
            "latest_total_kg": total_latest,
            "latest_pct": pct,
            "sample_rate_hz": self._estimate_sample_rate(),
            "hand": self.hand,
            "input_mode": self.settings.input_mode.value,
            "current_effort": self._current_effort_metrics.to_dict() if self._current_effort_metrics else None,
            "last_effort": self._last_effort_metrics.to_dict() if self._last_effort_metrics else None,
            "recording": self._recording,
            "connected": self.is_connected,
        }
        self.live_updated.emit(payload)

    def shutdown(self) -> None:
        try:
            if self._recording:
                self.stop_recording()
        except Exception:
            pass
        self.disconnect_source()
        self.settings.calibration = self.calibration.to_dict()
        self.settings_store.save(self.settings)
