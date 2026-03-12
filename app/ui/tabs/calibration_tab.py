from __future__ import annotations

from typing import Any

from PySide6.QtWidgets import (
    QComboBox,
    QDoubleSpinBox,
    QFormLayout,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QSpinBox,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from persistence import InputMode, UnitsMode
from ui.constants import FINGER_NAMES
from ui.viewmodels import AppController


class CalibrationSettingsTab(QWidget):
    def __init__(self, controller: AppController, parent=None):
        super().__init__(parent)
        self.controller = controller
        self._captured_tare_raw: float | None = None

        self._build_ui()
        self._bind()
        self._load_from_settings()
        self._refresh_calibration_table()

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)

        cal_group = QGroupBox("Calibration Wizard (MODE_RAW)")
        cg = QGridLayout(cal_group)

        self.cal_table = QTableWidget(4, 3)
        self.cal_table.setHorizontalHeaderLabels(["Finger", "Offset", "Scale"])
        self.cal_table.verticalHeader().setVisible(False)
        for i, name in enumerate(FINGER_NAMES):
            self.cal_table.setItem(i, 0, QTableWidgetItem(name))
        cg.addWidget(self.cal_table, 0, 0, 1, 6)

        cg.addWidget(QLabel("Finger:"), 1, 0)
        self.finger_combo = QComboBox()
        self.finger_combo.addItems(FINGER_NAMES)
        cg.addWidget(self.finger_combo, 1, 1)

        cg.addWidget(QLabel("Known kg:"), 1, 2)
        self.known_kg_spin = QDoubleSpinBox()
        self.known_kg_spin.setRange(0.01, 200.0)
        self.known_kg_spin.setDecimals(3)
        self.known_kg_spin.setValue(5.0)
        cg.addWidget(self.known_kg_spin, 1, 3)

        self.tare_all_btn = QPushButton("Tare All")
        self.tare_finger_btn = QPushButton("Tare Finger")
        cg.addWidget(self.tare_all_btn, 1, 4)
        cg.addWidget(self.tare_finger_btn, 1, 5)

        self.capture_tare_btn = QPushButton("Step 1: Capture Tare")
        self.capture_load_btn = QPushButton("Step 2: Capture Load + Compute")
        cg.addWidget(self.capture_tare_btn, 2, 0, 1, 3)
        cg.addWidget(self.capture_load_btn, 2, 3, 1, 3)

        self.cal_status_lbl = QLabel("Capture tare first, then capture load.")
        cg.addWidget(self.cal_status_lbl, 3, 0, 1, 6)

        root.addWidget(cal_group)

        settings_group = QGroupBox("Settings")
        form = QFormLayout(settings_group)

        self.input_mode_combo = QComboBox()
        self.input_mode_combo.addItems([InputMode.MODE_KG_DIRECT.value, InputMode.MODE_RAW.value])

        self.units_combo = QComboBox()
        self.units_combo.addItems([UnitsMode.KG.value, UnitsMode.N.value])

        self.hand_combo = QComboBox()
        self.hand_combo.addItems(["Right", "Left"])

        self.preferred_source_combo = QComboBox()
        self.preferred_source_combo.addItems(["Serial", "Simulator", "BLE_UART"])

        self.ui_theme_combo = QComboBox()
        self.ui_theme_combo.addItems(["light_clean"])

        self.smoothing_combo = QComboBox()
        self.smoothing_combo.addItems(["NONE", "EMA", "MOVING_AVG"])

        self.alpha_spin = QDoubleSpinBox()
        self.alpha_spin.setRange(0.01, 0.99)
        self.alpha_spin.setSingleStep(0.01)

        self.window_spin = QSpinBox()
        self.window_spin.setRange(1, 50)

        self.start_th_spin = QDoubleSpinBox()
        self.start_th_spin.setRange(0.01, 100.0)
        self.stop_th_spin = QDoubleSpinBox()
        self.stop_th_spin.setRange(0.01, 100.0)
        self.start_hold_spin = QSpinBox()
        self.start_hold_spin.setRange(20, 5000)
        self.stop_hold_spin = QSpinBox()
        self.stop_hold_spin.setRange(20, 5000)

        self.tut_spin = QDoubleSpinBox()
        self.tut_spin.setRange(0.01, 100.0)
        self.stab_th_spin = QDoubleSpinBox()
        self.stab_th_spin.setRange(0.01, 10.0)
        self.stab_hold_spin = QSpinBox()
        self.stab_hold_spin.setRange(20, 5000)

        self.ble_device_edit = QLineEdit()
        self.ble_device_edit.setPlaceholderText("ESP32 name/address")
        self.ble_rx_uuid_edit = QLineEdit()
        self.ble_rx_uuid_edit.setPlaceholderText("BLE RX UUID (notify)")
        self.ble_tx_uuid_edit = QLineEdit()
        self.ble_tx_uuid_edit.setPlaceholderText("BLE TX UUID (write)")

        form.addRow("Input mode:", self.input_mode_combo)
        form.addRow("Units:", self.units_combo)
        form.addRow("Preferred source:", self.preferred_source_combo)
        form.addRow("UI theme:", self.ui_theme_combo)
        form.addRow("Default hand:", self.hand_combo)
        form.addRow("Smoothing:", self.smoothing_combo)
        form.addRow("EMA alpha:", self.alpha_spin)
        form.addRow("MA window:", self.window_spin)
        form.addRow("Start threshold (kg):", self.start_th_spin)
        form.addRow("Stop threshold (kg):", self.stop_th_spin)
        form.addRow("Start hold (ms):", self.start_hold_spin)
        form.addRow("Stop hold (ms):", self.stop_hold_spin)
        form.addRow("TUT threshold (kg):", self.tut_spin)
        form.addRow("Stabilization threshold:", self.stab_th_spin)
        form.addRow("Stabilization hold (ms):", self.stab_hold_spin)
        form.addRow("BLE device id:", self.ble_device_edit)
        form.addRow("BLE RX UUID:", self.ble_rx_uuid_edit)
        form.addRow("BLE TX UUID:", self.ble_tx_uuid_edit)

        btn_row = QHBoxLayout()
        self.apply_btn = QPushButton("Apply & Save")
        self.read_factors_btn = QPushButton("Read Factors (firmware)")
        btn_row.addWidget(self.apply_btn)
        btn_row.addWidget(self.read_factors_btn)
        form.addRow(btn_row)

        root.addWidget(settings_group)
        root.addStretch()

    def _bind(self) -> None:
        self.tare_all_btn.clicked.connect(self.controller.tare_all)
        self.tare_finger_btn.clicked.connect(self._tare_selected_finger)
        self.capture_tare_btn.clicked.connect(self._capture_tare)
        self.capture_load_btn.clicked.connect(self._capture_load_and_compute)
        self.apply_btn.clicked.connect(self._apply_settings)
        self.read_factors_btn.clicked.connect(lambda: self.controller.send_source_command("p"))

        self.controller.calibration_changed.connect(lambda _: self._refresh_calibration_table())
        self.controller.settings_changed.connect(self._on_settings_changed)

    def _on_settings_changed(self, _settings: Any) -> None:
        self._load_from_settings()
        self._refresh_calibration_table()

    def _load_from_settings(self) -> None:
        s = self.controller.settings
        self.input_mode_combo.setCurrentText(s.input_mode.value)
        self.units_combo.setCurrentText(s.units.value)
        self.hand_combo.setCurrentText(s.hand_default)
        self.preferred_source_combo.setCurrentText(s.preferred_source)
        self.ui_theme_combo.setCurrentText(s.ui_theme)
        self.smoothing_combo.setCurrentText(s.smoothing_mode)
        self.alpha_spin.setValue(float(s.smoothing_alpha))
        self.window_spin.setValue(int(s.smoothing_window))

        self.start_th_spin.setValue(float(s.start_threshold_kg))
        self.stop_th_spin.setValue(float(s.stop_threshold_kg))
        self.start_hold_spin.setValue(int(s.start_hold_ms))
        self.stop_hold_spin.setValue(int(s.stop_hold_ms))
        self.tut_spin.setValue(float(s.tut_threshold_kg))
        self.stab_th_spin.setValue(float(s.stabilization_shift_threshold))
        self.stab_hold_spin.setValue(int(s.stabilization_hold_ms))
        self.ble_device_edit.setText(s.ble_device_id)
        self.ble_rx_uuid_edit.setText(s.ble_rx_uuid)
        self.ble_tx_uuid_edit.setText(s.ble_tx_uuid)

    def _refresh_calibration_table(self) -> None:
        c = self.controller.get_calibration()
        for i in range(4):
            self.cal_table.setItem(i, 1, QTableWidgetItem(f"{float(c.offsets[i]):.3f}"))
            self.cal_table.setItem(i, 2, QTableWidgetItem(f"{float(c.scales[i]):.9f}"))

    def _tare_selected_finger(self) -> None:
        self.controller.tare_finger(self.finger_combo.currentIndex())

    def _capture_tare(self) -> None:
        finger_idx = self.finger_combo.currentIndex()
        value = self.controller.recent_raw_median(finger_idx, window_s=2.0)
        if value is None:
            self.cal_status_lbl.setText("No live samples available")
            return
        self._captured_tare_raw = value
        self.cal_status_lbl.setText(
            f"Tare captured for {FINGER_NAMES[finger_idx]}: {value:.3f}. Add known load and capture step 2."
        )

    def _capture_load_and_compute(self) -> None:
        if self._captured_tare_raw is None:
            self.cal_status_lbl.setText("Capture tare first")
            return
        finger_idx = self.finger_combo.currentIndex()
        loaded = self.controller.recent_raw_median(finger_idx, window_s=2.0)
        if loaded is None:
            self.cal_status_lbl.setText("No load samples available")
            return
        known = float(self.known_kg_spin.value())
        try:
            scale = self.controller.calibrate_finger_with_values(
                finger_idx=finger_idx,
                tare_raw=self._captured_tare_raw,
                loaded_raw=loaded,
                known_kg=known,
            )
        except Exception as exc:
            self.cal_status_lbl.setText(f"Calibration failed: {exc}")
            return
        self._captured_tare_raw = None
        self.cal_status_lbl.setText(f"Calibration saved. Scale={scale:.9f}")
        self._refresh_calibration_table()

    def _apply_settings(self) -> None:
        updates = {
            "input_mode": InputMode(self.input_mode_combo.currentText()),
            "units": UnitsMode(self.units_combo.currentText()),
            "preferred_source": self.preferred_source_combo.currentText(),
            "ui_theme": self.ui_theme_combo.currentText(),
            "hand_default": self.hand_combo.currentText(),
            "smoothing_mode": self.smoothing_combo.currentText(),
            "smoothing_alpha": float(self.alpha_spin.value()),
            "smoothing_window": int(self.window_spin.value()),
            "start_threshold_kg": float(self.start_th_spin.value()),
            "stop_threshold_kg": float(self.stop_th_spin.value()),
            "start_hold_ms": int(self.start_hold_spin.value()),
            "stop_hold_ms": int(self.stop_hold_spin.value()),
            "tut_threshold_kg": float(self.tut_spin.value()),
            "stabilization_shift_threshold": float(self.stab_th_spin.value()),
            "stabilization_hold_ms": int(self.stab_hold_spin.value()),
            "ble_device_id": self.ble_device_edit.text().strip(),
            "ble_rx_uuid": self.ble_rx_uuid_edit.text().strip(),
            "ble_tx_uuid": self.ble_tx_uuid_edit.text().strip(),
        }
        self.controller.update_settings(updates)
        self.controller.set_input_mode(InputMode(self.input_mode_combo.currentText()))
        self.controller.set_hand(self.hand_combo.currentText())
        self.cal_status_lbl.setText("Settings applied")
