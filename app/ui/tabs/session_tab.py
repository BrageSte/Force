from __future__ import annotations

from typing import Any

import pyqtgraph as pg
from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from ui.constants import FINGER_COLORS, FINGER_NAMES, TOTAL_COLOR
from ui.theme import PALETTE
from ui.viewmodels import AppController


class SessionAnalysisTab(QWidget):
    def __init__(self, controller: AppController, parent=None):
        super().__init__(parent)
        self.controller = controller
        self._efforts: list[dict[str, Any]] = []
        self._marker_lines: list[pg.InfiniteLine] = []

        self._build_ui()
        self._bind()

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)

        self.summary_lbl = QLabel("No session loaded")
        root.addWidget(self.summary_lbl)

        self.table = QTableWidget(0, 17)
        self.table.setHorizontalHeaderLabels(
            [
                "#",
                "start_ms",
                "dur_s",
                "peak_kg",
                "Index",
                "Middle",
                "Ring",
                "Pinky",
                "avg_kg",
                "TUT",
                "RFD100",
                "RFD200",
                "Imbalance",
                "LoadVar",
                "Switch",
                "ShiftRate",
                "Stab_s",
            ]
        )
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        self.table.horizontalHeader().setStretchLastSection(True)
        root.addWidget(self.table, 1)

        plots_row = QHBoxLayout()

        g1 = QGroupBox("Effort: total + finger kg")
        g1l = QVBoxLayout(g1)
        self.plot_force = pg.PlotWidget()
        self.plot_force.setBackground(PALETTE["surface"])
        self.plot_force.showGrid(x=True, y=True, alpha=0.2)
        self.plot_force.setLabel("left", "kg")
        self.plot_force.setLabel("bottom", "s")
        self.plot_force_total = self.plot_force.plot([], [], pen=pg.mkPen(TOTAL_COLOR, width=3), name="Total")
        self.plot_force_fingers = [
            self.plot_force.plot([], [], pen=pg.mkPen(FINGER_COLORS[i], width=2), name=FINGER_NAMES[i])
            for i in range(4)
        ]
        g1l.addWidget(self.plot_force)
        plots_row.addWidget(g1, 1)

        g2 = QGroupBox("Effort: finger % over time")
        g2l = QVBoxLayout(g2)
        self.plot_pct = pg.PlotWidget()
        self.plot_pct.setBackground(PALETTE["surface"])
        self.plot_pct.showGrid(x=True, y=True, alpha=0.2)
        self.plot_pct.setLabel("left", "%")
        self.plot_pct.setLabel("bottom", "s")
        self.plot_pct_curves = [
            self.plot_pct.plot([], [], pen=pg.mkPen(FINGER_COLORS[i], width=2), name=FINGER_NAMES[i])
            for i in range(4)
        ]
        g2l.addWidget(self.plot_pct)
        plots_row.addWidget(g2, 1)

        root.addLayout(plots_row, 1)

    def _bind(self) -> None:
        self.controller.session_analysis_updated.connect(self._on_session_analysis)
        self.table.itemSelectionChanged.connect(self._on_table_select)

    def load_session_payload(self, payload: dict[str, Any]) -> None:
        summary = payload.get("summary", {})
        efforts = payload.get("efforts", [])
        self._on_session_analysis(efforts, summary)

    def _on_session_analysis(self, efforts_obj: Any, summary_obj: Any) -> None:
        efforts = []
        for e in efforts_obj or []:
            if hasattr(e, "to_dict"):
                efforts.append(e.to_dict())
            else:
                efforts.append(dict(e))
        self._efforts = efforts

        summary = summary_obj.to_dict() if hasattr(summary_obj, "to_dict") else dict(summary_obj)
        self.summary_lbl.setText(
            f"Efforts: {int(summary.get('efforts_count', len(efforts)))} | "
            f"Best peak: {float(summary.get('best_peak_kg', 0.0)):.1f} kg | "
            f"Avg peak: {float(summary.get('avg_peak_kg', 0.0)):.1f} kg | "
            f"Fatigue slope: {float(summary.get('fatigue_slope_kg_per_effort', 0.0)):.3f} kg/effort"
        )

        self.table.setRowCount(len(efforts))
        for r, e in enumerate(efforts):
            peaks = e.get("peak_per_finger_kg", [0, 0, 0, 0])
            vals = [
                str(e.get("effort_id", r + 1)),
                str(e.get("start_t_ms", "")),
                f"{float(e.get('duration_s', 0.0)):.2f}",
                f"{float(e.get('peak_total_kg', 0.0)):.1f}",
                f"{float(peaks[0]):.1f}",
                f"{float(peaks[1]):.1f}",
                f"{float(peaks[2]):.1f}",
                f"{float(peaks[3]):.1f}",
                f"{float(e.get('avg_total_kg', 0.0)):.1f}",
                f"{float(e.get('tut_s', 0.0)):.2f}",
                f"{float(e.get('rfd_100_kg_s', 0.0)):.1f}",
                f"{float(e.get('rfd_200_kg_s', 0.0)):.1f}",
                f"{float(e.get('finger_imbalance_index', 0.0)):.2f}",
                f"{float(e.get('load_variation_cv', 0.0)):.3f}",
                str(int(e.get("dominant_switch_count", 0))),
                f"{float(e.get('load_shift_rate', 0.0)):.3f}",
                "—" if e.get("stabilization_time_s") is None else f"{float(e.get('stabilization_time_s', 0.0)):.2f}",
            ]
            for c, value in enumerate(vals):
                self.table.setItem(r, c, QTableWidgetItem(value))

        if efforts:
            self.table.selectRow(0)
        else:
            self._clear_detail()

    def _clear_detail(self) -> None:
        self.plot_force_total.setData([], [])
        for c in self.plot_force_fingers:
            c.setData([], [])
        for c in self.plot_pct_curves:
            c.setData([], [])

    def _on_table_select(self) -> None:
        selected = self.table.selectionModel().selectedRows()
        if not selected:
            return
        row = selected[0].row()
        if row < 0 or row >= len(self._efforts):
            return
        effort = self._efforts[row]
        self._show_effort_detail(effort)

    def _show_effort_detail(self, e: dict[str, Any]) -> None:
        t_ms = e.get("detail_t_ms", [])
        total = e.get("detail_total_kg", [])
        fingers = e.get("detail_finger_kg", [])
        pcts = e.get("detail_finger_pct", [])
        if not t_ms or not total or not fingers:
            self._clear_detail()
            return

        t_s = [float(v) / 1000.0 for v in t_ms]

        self.plot_force_total.setData(t_s, total)
        for i in range(4):
            self.plot_force_fingers[i].setData(t_s, [float(row[i]) for row in fingers])

        for i in range(4):
            self.plot_pct_curves[i].setData(t_s, [float(row[i]) for row in pcts])

        for line in self._marker_lines:
            try:
                self.plot_force.removeItem(line)
            except Exception:
                pass
            try:
                self.plot_pct.removeItem(line)
            except Exception:
                pass
        self._marker_lines = []

        # Mark peak and hold start
        peak_idx = int(max(range(len(total)), key=lambda idx: float(total[idx])))
        peak_t = t_s[peak_idx]
        peak_line_force = pg.InfiniteLine(pos=peak_t, angle=90, pen=pg.mkPen("#f38ba8", width=1.5))
        hold_t = float(int(e.get("hold_start_t_ms", e.get("start_t_ms", 0))) - int(e.get("start_t_ms", 0))) / 1000.0
        hold_line_force = pg.InfiniteLine(pos=hold_t, angle=90, pen=pg.mkPen("#89b4fa", width=1.5, style=Qt.DashLine))
        peak_line_pct = pg.InfiniteLine(pos=peak_t, angle=90, pen=pg.mkPen("#f38ba8", width=1.5))
        hold_line_pct = pg.InfiniteLine(pos=hold_t, angle=90, pen=pg.mkPen("#89b4fa", width=1.5, style=Qt.DashLine))

        self.plot_force.addItem(peak_line_force)
        self.plot_force.addItem(hold_line_force)
        self.plot_pct.addItem(peak_line_pct)
        self.plot_pct.addItem(hold_line_pct)
        self._marker_lines.extend([peak_line_force, hold_line_force, peak_line_pct, hold_line_pct])
