from pathlib import Path

from PySide6.QtCore import QCoreApplication

from acquisition import AcquisitionSample
from persistence import InputMode
from ui.viewmodels import AppController


def _qapp() -> QCoreApplication:
    app = QCoreApplication.instance()
    if app is None:
        app = QCoreApplication([])
    return app


def test_autoswitch_to_raw_when_counts_received_in_kg_direct(tmp_path: Path) -> None:
    _qapp()
    controller = AppController(app_dir=tmp_path)
    controller.set_input_mode(InputMode.MODE_KG_DIRECT)

    messages: list[str] = []
    live_payloads: list[dict] = []
    controller.status_message.connect(messages.append)
    controller.live_updated.connect(live_payloads.append)

    controller._source_kind = "Serial"
    controller._on_acquisition_sample(AcquisitionSample(t_ms=0, values=(200000.0, 180000.0, 160000.0, 150000.0)))

    assert controller.settings.input_mode == InputMode.MODE_RAW
    assert any("switched to mode_raw automatically" in m.lower() for m in messages)

    assert live_payloads
    latest = live_payloads[-1]
    total = float(latest.get("latest_total_kg", 0.0))
    # With default raw scale (1e-5), totals should be in single-digit kg range, not count-scale.
    assert abs(total) < 20.0
    controller.shutdown()

