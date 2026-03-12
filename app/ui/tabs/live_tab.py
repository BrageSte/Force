from __future__ import annotations

import pyqtgraph as pg
from pyqtgraph.dockarea import Dock, DockArea
from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QComboBox,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QVBoxLayout,
    QWidget,
)

from persistence import InputMode
from ui.constants import FINGER_COLORS, FINGER_NAMES, display_order
from ui.theme import PALETTE
from ui.viewmodels import AppController
from ui.widgets import MetricRow, PrimaryButton, SecondaryButton, SectionPanel, StatCard


class LiveTab(QWidget):
    def __init__(self, controller: AppController, parent=None):
        super().__init__(parent)
        self.controller = controller
        self._readable_mode = True

        self._build_ui()
        self._bind()
        self.refresh_ports()

        preferred = getattr(self.controller.settings, "preferred_source", "Serial")
        if preferred in ("Serial", "Simulator", "BLE_UART"):
            self.source_combo.setCurrentText(preferred)
        default_baud = str(getattr(self.controller.settings, "default_baud", 115200))
        i_baud = self.baud_combo.findText(default_baud)
        if i_baud >= 0:
            self.baud_combo.setCurrentIndex(i_baud)
        default_port = getattr(self.controller.settings, "default_port", "")
        i_port = self.port_combo.findText(default_port)
        if i_port >= 0:
            self.port_combo.setCurrentIndex(i_port)
        self._on_source_changed(self.source_combo.currentText())

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        self.dock_area = DockArea()
        root.addWidget(self.dock_area, 1)

        conn_panel = SectionPanel("Connection", "Data source and link settings")
        conn_grid = QGridLayout()
        conn_grid.setHorizontalSpacing(8)
        conn_grid.setVerticalSpacing(8)

        self.source_combo = QComboBox()
        self.source_combo.addItems(["Serial", "Simulator", "BLE_UART"])
        self.port_combo = QComboBox()
        self.port_combo.setMinimumWidth(150)
        self.refresh_ports_btn = SecondaryButton("Refresh Ports")
        self.baud_combo = QComboBox()
        self.baud_combo.addItems(["115200", "57600", "9600"])
        self.connect_btn = PrimaryButton("Connect")

        conn_grid.addWidget(QLabel("Source"), 0, 0)
        conn_grid.addWidget(self.source_combo, 0, 1)
        conn_grid.addWidget(QLabel("Port"), 1, 0)
        conn_grid.addWidget(self.port_combo, 1, 1)
        conn_grid.addWidget(self.refresh_ports_btn, 1, 2)
        conn_grid.addWidget(QLabel("Baud"), 2, 0)
        conn_grid.addWidget(self.baud_combo, 2, 1)
        conn_grid.addWidget(self.connect_btn, 2, 2)
        conn_panel.body.addLayout(conn_grid)

        session_panel = SectionPanel("Session", "Recording and reset controls")
        session_row = QHBoxLayout()
        session_row.setSpacing(8)
        self.record_btn = PrimaryButton("Start Recording")
        self.reset_effort_btn = SecondaryButton("Reset Effort")
        self.reset_session_btn = SecondaryButton("Reset Session")
        session_row.addWidget(self.record_btn)
        session_row.addWidget(self.reset_effort_btn)
        session_row.addWidget(self.reset_session_btn)
        session_panel.body.addLayout(session_row)
        self.sample_rate_lbl = QLabel("Sample rate: ~0.0 Hz")
        self.sample_rate_lbl.setStyleSheet("font-weight:700; color:#5c6f89;")
        session_panel.body.addWidget(self.sample_rate_lbl)

        actions_panel = SectionPanel("Actions", "Hand, tare and readability mode")
        actions_grid = QGridLayout()
        actions_grid.setHorizontalSpacing(8)
        actions_grid.setVerticalSpacing(8)
        self.hand_btn = SecondaryButton("Hand: Right")
        self.input_mode_btn = SecondaryButton("Input: MODE_RAW")
        self.precision_btn = SecondaryButton("View: Readable (0.1)")
        self.tare_all_btn = SecondaryButton("Tare All")
        self.tare_finger_combo = QComboBox()
        self.tare_finger_combo.addItems(FINGER_NAMES)
        self.tare_finger_btn = SecondaryButton("Tare Finger")
        actions_grid.addWidget(self.hand_btn, 0, 0)
        actions_grid.addWidget(self.input_mode_btn, 0, 1)
        actions_grid.addWidget(self.precision_btn, 0, 2)
        actions_grid.addWidget(self.tare_all_btn, 1, 0)
        actions_grid.addWidget(self.tare_finger_combo, 1, 1)
        actions_grid.addWidget(self.tare_finger_btn, 1, 2)
        actions_panel.body.addLayout(actions_grid)

        controls_host = QWidget()
        controls_layout = QHBoxLayout(controls_host)
        controls_layout.setContentsMargins(2, 2, 2, 2)
        controls_layout.setSpacing(10)
        controls_layout.addWidget(conn_panel, 3)
        controls_layout.addWidget(session_panel, 2)
        controls_layout.addWidget(actions_panel, 3)

        self.controls_dock = Dock("Controls (drag to move / resize)", size=(1300, 220))
        self.controls_dock.addWidget(controls_host)
        self.dock_area.addDock(self.controls_dock, "top")

        kpi_host = QWidget()
        kpi_layout = QHBoxLayout(kpi_host)
        kpi_layout.setContentsMargins(2, 2, 2, 2)
        kpi_layout.setSpacing(8)

        self.total_card = StatCard("Total", "0.0 kg", "Total load")
        self.total_card.set_accent("#0b84f3")
        kpi_layout.addWidget(self.total_card, 2)

        self.finger_cards: list[StatCard] = []
        for i in range(4):
            card = StatCard(FINGER_NAMES[i], "0.0 kg", "0.0% of total")
            card.set_accent(FINGER_COLORS[i])
            self.finger_cards.append(card)
            kpi_layout.addWidget(card, 1)

        self.kpi_dock = Dock("KPI Cards", size=(1300, 140))
        self.kpi_dock.addWidget(kpi_host)
        self.dock_area.addDock(self.kpi_dock, "bottom", self.controls_dock)

        force_panel = SectionPanel("Live Force", "Total and per-finger ring buffer")
        self.plot = pg.PlotWidget()
        self.plot.setBackground(PALETTE["surface"])
        self.plot.showGrid(x=True, y=True, alpha=0.25)
        self.plot.setLabel("left", "kg")
        self.plot.setLabel("bottom", "seconds")
        self.zero_line = pg.InfiniteLine(pos=0, angle=0, pen=pg.mkPen("#c3cfdf", style=Qt.DotLine))
        self.plot.addItem(self.zero_line)
        self.total_curve = self.plot.plot([], [], pen=pg.mkPen("#1f3d69", width=3))
        self.finger_curves = [
            self.plot.plot([], [], pen=pg.mkPen(FINGER_COLORS[i], width=2.0))
            for i in range(4)
        ]
        force_panel.body.addWidget(self.plot, 1)

        self.force_dock = Dock("Live Plot", size=(900, 560))
        self.force_dock.addWidget(force_panel)
        self.dock_area.addDock(self.force_dock, "bottom", self.kpi_dock)

        dist_panel = SectionPanel("Load Distribution", "Percentage split per finger")
        self.dist_total_lbl = QLabel("Total: 0.0 kg")
        self.dist_total_lbl.setStyleSheet("font-weight:700; color:#1f3d69;")
        dist_panel.body.addWidget(self.dist_total_lbl)

        self.dist_plot = pg.PlotWidget()
        self.dist_plot.setBackground(PALETTE["surface"])
        self.dist_plot.showGrid(x=False, y=True, alpha=0.25)
        self.dist_plot.setLabel("left", "% of total")
        self.dist_plot.setYRange(0.0, 100.0, padding=0.0)
        self.dist_plot.setXRange(-0.5, 3.5, padding=0.0)
        self.dist_plot.getAxis("bottom").setTicks([[(0, "Index"), (1, "Middle"), (2, "Ring"), (3, "Pinky")]])
        self.dist_bars: list[pg.BarGraphItem] = []
        for i in range(4):
            bar = pg.BarGraphItem(x=[float(i)], height=[0.0], width=0.62, brush=pg.mkBrush(FINGER_COLORS[i]))
            self.dist_plot.addItem(bar)
            self.dist_bars.append(bar)
        dist_panel.body.addWidget(self.dist_plot, 1)

        self.dist_dock = Dock("Distribution", size=(360, 290))
        self.dist_dock.addWidget(dist_panel)
        self.dock_area.addDock(self.dist_dock, "right", self.force_dock)

        effort_panel = SectionPanel("Current Effort", "Peak, timing and RFD")
        self.m_peak_total = MetricRow("Peak total", "-")
        self.m_peak_fingers = MetricRow("Peak per finger", "-")
        self.m_time_to_peak = MetricRow("Time to peak", "-")
        self.m_rfd_100 = MetricRow("RFD 0-100ms", "-")
        self.m_rfd_200 = MetricRow("RFD 0-200ms", "-")
        self.m_rfd_100.setToolTip("RFD0-100ms = (F(t0+100ms)-F(t0))/0.1s")
        self.m_rfd_200.setToolTip("RFD0-200ms = (F(t0+200ms)-F(t0))/0.2s")
        effort_panel.body.addWidget(self.m_peak_total)
        effort_panel.body.addWidget(self.m_peak_fingers)
        effort_panel.body.addWidget(self.m_time_to_peak)
        effort_panel.body.addWidget(self.m_rfd_100)
        effort_panel.body.addWidget(self.m_rfd_200)
        effort_panel.body.addStretch(1)

        self.effort_dock = Dock("Effort Metrics", size=(360, 270))
        self.effort_dock.addWidget(effort_panel)
        self.dock_area.addDock(self.effort_dock, "bottom", self.dist_dock)

    def _bind(self) -> None:
        self.refresh_ports_btn.clicked.connect(self.refresh_ports)
        self.connect_btn.clicked.connect(self._toggle_connect)
        self.record_btn.clicked.connect(self._toggle_record)
        self.hand_btn.clicked.connect(self._toggle_hand)
        self.input_mode_btn.clicked.connect(self._toggle_input_mode)
        self.tare_all_btn.clicked.connect(self.controller.tare_all)
        self.tare_finger_btn.clicked.connect(self._tare_finger)
        self.reset_effort_btn.clicked.connect(self.controller.reset_effort)
        self.reset_session_btn.clicked.connect(self.controller.reset_session)
        self.precision_btn.clicked.connect(self._toggle_precision)

        self.controller.live_updated.connect(self._on_live)
        self.controller.connection_changed.connect(self._on_connection)
        self.controller.recording_changed.connect(self._on_recording)
        self.source_combo.currentTextChanged.connect(self._on_source_changed)

    def refresh_ports(self) -> None:
        current = self.port_combo.currentText()
        self.port_combo.clear()
        for p in self.controller.available_ports():
            self.port_combo.addItem(p)
        if current:
            i = self.port_combo.findText(current)
            if i >= 0:
                self.port_combo.setCurrentIndex(i)

    def _toggle_connect(self) -> None:
        if self.controller.is_connected:
            self.controller.disconnect_source()
            return

        source = self.source_combo.currentText()
        port = self.port_combo.currentText().strip()
        baud = int(self.baud_combo.currentText())

        self.controller.update_settings(
            {
                "preferred_source": source,
                "default_port": port,
                "default_baud": baud,
            }
        )
        self.controller.connect_source(source_kind=source, port=port, baud=baud)

    def _on_source_changed(self, source: str) -> None:
        is_serial = source == "Serial"
        self.port_combo.setEnabled(is_serial)
        self.refresh_ports_btn.setEnabled(is_serial)
        self.baud_combo.setEnabled(is_serial)

    def _toggle_record(self) -> None:
        if self.controller.is_recording:
            self.controller.stop_recording()
        else:
            self.controller.start_recording()

    def _toggle_hand(self) -> None:
        new_hand = "Left" if self.controller.hand == "Right" else "Right"
        self.controller.set_hand(new_hand)

    def _toggle_input_mode(self) -> None:
        current = self.controller.settings.input_mode
        next_mode = InputMode.MODE_RAW if current == InputMode.MODE_KG_DIRECT else InputMode.MODE_KG_DIRECT
        self.controller.set_input_mode(next_mode)

    def _tare_finger(self) -> None:
        idx = self.tare_finger_combo.currentIndex()
        self.controller.tare_finger(idx)

    def _on_connection(self, connected: bool) -> None:
        self.connect_btn.setText("Disconnect" if connected else "Connect")

    def _on_recording(self, recording: bool) -> None:
        self.record_btn.setText("Stop Recording" if recording else "Start Recording")

    def _toggle_precision(self) -> None:
        self._readable_mode = not self._readable_mode
        if self._readable_mode:
            self.precision_btn.setText("View: Readable (0.1)")
        else:
            self.precision_btn.setText("View: Detailed (0.001)")

    def _fmt_kg(self, value: float) -> str:
        return f"{value:.1f}" if self._readable_mode else f"{value:.3f}"

    def _fmt_pct(self, value: float) -> str:
        return f"{value:.1f}" if self._readable_mode else f"{value:.2f}"

    def _fmt_rate(self, value: float) -> str:
        return f"{value:.1f}" if self._readable_mode else f"{value:.2f}"

    def _on_live(self, payload: dict) -> None:
        hand = str(payload.get("hand", "Right"))
        self.hand_btn.setText(f"Hand: {hand}")
        mode = str(payload.get("input_mode", self.controller.settings.input_mode.value))
        self.input_mode_btn.setText(f"Input: {mode}")

        t = payload.get("t_s", [])
        finger_series = payload.get("finger_series_kg", [[0], [0], [0], [0]])
        total_series = payload.get("total_series_kg", [0])
        latest = payload.get("latest_kg", (0, 0, 0, 0))
        latest_total = float(payload.get("latest_total_kg", 0.0))
        latest_pct = payload.get("latest_pct", (0, 0, 0, 0))
        sr = float(payload.get("sample_rate_hz", 0.0))

        self.sample_rate_lbl.setText(f"Sample rate: ~{sr:.1f} Hz")

        order = display_order(hand)
        for slot, src_idx in enumerate(order):
            name = FINGER_NAMES[src_idx]
            kg = float(latest[src_idx])
            pct = float(latest_pct[src_idx])
            self.finger_cards[slot].set_title(name)
            self.finger_cards[slot].set_value(f"{self._fmt_kg(kg)} kg")
            self.finger_cards[slot].set_subtitle(f"{self._fmt_pct(pct)}% of total")
            self.finger_cards[slot].set_accent(FINGER_COLORS[src_idx])
            self.finger_curves[slot].setData(t, finger_series[src_idx])
            self.finger_curves[slot].setPen(pg.mkPen(FINGER_COLORS[src_idx], width=2.0))

        self.total_card.set_value(f"{self._fmt_kg(latest_total)} kg")
        self.dist_total_lbl.setText(f"Total: {self._fmt_kg(latest_total)} kg")

        dist_vals = [max(0.0, float(latest_pct[src_idx])) for src_idx in order]
        dist_max = max(dist_vals) if dist_vals else 0.0
        top = max(8.0, dist_max * 1.2)
        self.dist_plot.setYRange(0.0, top, padding=0.0)
        self.dist_plot.getAxis("bottom").setTicks(
            [[(i, FINGER_NAMES[src_idx]) for i, src_idx in enumerate(order)]]
        )
        for slot, src_idx in enumerate(order):
            self.dist_bars[slot].setOpts(
                x=[float(slot)],
                height=[dist_vals[slot]],
                width=0.62,
                brush=pg.mkBrush(FINGER_COLORS[src_idx]),
            )

        self.total_curve.setData(t, total_series)

        current = payload.get("current_effort") or payload.get("last_effort")
        if not current:
            self.m_peak_total.set_value("-")
            self.m_peak_fingers.set_value("-")
            self.m_time_to_peak.set_value("-")
            self.m_rfd_100.set_value("-")
            self.m_rfd_200.set_value("-")
        else:
            peak_total = float(current.get("peak_total_kg", 0.0))
            peaks = current.get("peak_per_finger_kg", [0, 0, 0, 0])
            ttp = float(current.get("time_to_peak_s", 0.0))
            rfd100kg = float(current.get("rfd_100_kg_s", 0.0))
            rfd200kg = float(current.get("rfd_200_kg_s", 0.0))
            rfd100n = float(current.get("rfd_100_n_s", 0.0))
            rfd200n = float(current.get("rfd_200_n_s", 0.0))

            self.m_peak_total.set_value(f"{self._fmt_kg(peak_total)} kg")
            self.m_peak_fingers.set_value(
                ", ".join(f"{FINGER_NAMES[i]} {self._fmt_kg(float(peaks[i]))}" for i in order)
            )
            self.m_time_to_peak.set_value(f"{ttp:.2f} s")
            self.m_rfd_100.set_value(
                f"{self._fmt_rate(rfd100kg)} kg/s ({self._fmt_rate(rfd100n)} N/s)"
            )
            self.m_rfd_200.set_value(
                f"{self._fmt_rate(rfd200kg)} kg/s ({self._fmt_rate(rfd200n)} N/s)"
            )

        if len(total_series) >= 2:
            y_all: list[float] = []
            for src_idx in order:
                y_all.extend(float(v) for v in finger_series[src_idx])
            y_all.extend(float(v) for v in total_series)
            y_min = min(y_all)
            y_max = max(y_all)
            span = max(0.4, y_max - y_min)
            pad = span * 0.12
            self.plot.setYRange(y_min - pad, y_max + pad, padding=0.0)
