from pathlib import Path

from PySide6.QtCore import QCoreApplication

from ui.viewmodels import AppController


def _qapp() -> QCoreApplication:
    app = QCoreApplication.instance()
    if app is None:
        app = QCoreApplication([])
    return app


def test_ble_source_reports_not_configured(tmp_path: Path) -> None:
    _qapp()
    controller = AppController(app_dir=tmp_path)
    messages: list[str] = []
    controller.status_message.connect(messages.append)

    controller.connect_source("BLE_UART")

    assert not controller.is_connected
    assert any("not configured" in m.lower() for m in messages)
    controller.shutdown()


def test_ble_source_reports_not_implemented_when_configured(tmp_path: Path) -> None:
    _qapp()
    controller = AppController(app_dir=tmp_path)
    messages: list[str] = []
    controller.status_message.connect(messages.append)

    controller.update_settings(
        {
            "ble_device_id": "ESP32_FORCE",
            "ble_rx_uuid": "0000ffe1-0000-1000-8000-00805f9b34fb",
            "ble_tx_uuid": "0000ffe2-0000-1000-8000-00805f9b34fb",
        }
    )
    controller.connect_source("BLE_UART")

    assert not controller.is_connected
    assert any("not implemented" in m.lower() for m in messages)
    controller.shutdown()

