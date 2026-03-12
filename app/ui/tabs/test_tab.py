from __future__ import annotations

from PySide6.QtCore import QTimer
from PySide6.QtWidgets import (
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from ui.viewmodels import AppController


class TestTab(QWidget):
    def __init__(self, controller: AppController, parent=None):
        super().__init__(parent)
        self.controller = controller

        self._countdown_kind: str | None = None
        self._countdown_left = 0
        self._countdown_timer = QTimer(self)
        self._countdown_timer.setInterval(1000)
        self._countdown_timer.timeout.connect(self._countdown_tick)

        self._build_ui()
        self._bind()

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(8, 8, 8, 8)

        row = QHBoxLayout()
        self.max_btn = QPushButton("Max Pull Test")
        self.hang_btn = QPushButton("Hang / Long Effort")
        row.addWidget(self.max_btn)
        row.addWidget(self.hang_btn)
        row.addStretch()
        root.addLayout(row)

        self.countdown_lbl = QLabel("Ready")
        self.countdown_lbl.setStyleSheet("font-size: 40px; font-weight: bold;")
        root.addWidget(self.countdown_lbl)

        result = QGroupBox("Result")
        form = QFormLayout(result)
        self.kind_lbl = QLabel("—")
        self.peak_lbl = QLabel("—")
        self.rfd_lbl = QLabel("—")
        self.ttp_lbl = QLabel("—")
        self.hold_lbl = QLabel("—")

        form.addRow("Test:", self.kind_lbl)
        form.addRow("Peak total:", self.peak_lbl)
        form.addRow("RFD (0-100 / 0-200):", self.rfd_lbl)
        form.addRow("Time to peak:", self.ttp_lbl)
        form.addRow("Hold avg / TUT:", self.hold_lbl)
        root.addWidget(result)
        root.addStretch()

    def _bind(self) -> None:
        self.max_btn.clicked.connect(lambda: self._start_countdown("max_pull"))
        self.hang_btn.clicked.connect(lambda: self._start_countdown("hang"))
        self.controller.test_result_ready.connect(self._on_test_result)

    def _start_countdown(self, kind: str) -> None:
        if not self.controller.is_connected:
            self.countdown_lbl.setText("Connect source first")
            return
        self._countdown_kind = kind
        self._countdown_left = 3
        self.max_btn.setEnabled(False)
        self.hang_btn.setEnabled(False)
        self.countdown_lbl.setText("3")
        self._countdown_timer.start()

    def _countdown_tick(self) -> None:
        self._countdown_left -= 1
        if self._countdown_left > 0:
            self.countdown_lbl.setText(str(self._countdown_left))
            return
        self._countdown_timer.stop()
        self.countdown_lbl.setText("GO")
        if self._countdown_kind is not None:
            self.controller.start_test(self._countdown_kind)
        self.max_btn.setEnabled(True)
        self.hang_btn.setEnabled(True)

    def _on_test_result(self, payload: dict) -> None:
        kind = payload.get("test_kind", "")
        metrics = payload.get("metrics", {})
        if hasattr(metrics, "to_dict"):
            metrics = metrics.to_dict()

        self.kind_lbl.setText("Max Pull" if kind == "max_pull" else "Hang")
        self.peak_lbl.setText(f"{float(metrics.get('peak_total_kg', 0.0)):.1f} kg")
        self.rfd_lbl.setText(
            f"{float(metrics.get('rfd_100_kg_s', 0.0)):.1f} / {float(metrics.get('rfd_200_kg_s', 0.0)):.1f} kg/s"
        )
        self.ttp_lbl.setText(f"{float(metrics.get('time_to_peak_s', 0.0)):.2f} s")
        self.hold_lbl.setText(
            f"{float(metrics.get('avg_total_kg', 0.0)):.1f} kg / {float(metrics.get('tut_s', 0.0)):.2f} s"
        )
