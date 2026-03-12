from __future__ import annotations

from datetime import datetime
from typing import Any

from PySide6.QtCore import QDate, Signal
from PySide6.QtWidgets import (
    QComboBox,
    QDateEdit,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from persistence import SessionMeta
from ui.viewmodels import AppController


class HistoryTab(QWidget):
    session_loaded = Signal(object)

    def __init__(self, controller: AppController, parent=None):
        super().__init__(parent)
        self.controller = controller
        self._all: list[SessionMeta] = []

        self._build_ui()
        self._bind()
        self.refresh_sessions()

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)

        filters = QGridLayout()
        filters.addWidget(QLabel("From:"), 0, 0)
        self.from_date = QDateEdit()
        self.from_date.setCalendarPopup(True)
        self.from_date.setDate(QDate.currentDate().addMonths(-1))
        filters.addWidget(self.from_date, 0, 1)

        filters.addWidget(QLabel("To:"), 0, 2)
        self.to_date = QDateEdit()
        self.to_date.setCalendarPopup(True)
        self.to_date.setDate(QDate.currentDate().addDays(1))
        filters.addWidget(self.to_date, 0, 3)

        filters.addWidget(QLabel("Hand:"), 0, 4)
        self.hand_filter = QComboBox()
        self.hand_filter.addItems(["All", "Right", "Left"])
        filters.addWidget(self.hand_filter, 0, 5)

        filters.addWidget(QLabel("Tag/Notes:"), 1, 0)
        self.tag_filter = QLineEdit()
        filters.addWidget(self.tag_filter, 1, 1, 1, 3)

        self.refresh_btn = QPushButton("Refresh")
        self.load_btn = QPushButton("Load Selected")
        self.export_btn = QPushButton("Export Efforts CSV")
        filters.addWidget(self.refresh_btn, 1, 4)
        filters.addWidget(self.load_btn, 1, 5)
        filters.addWidget(self.export_btn, 1, 6)
        root.addLayout(filters)

        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(["session_id", "date", "hand", "efforts", "best_peak", "tag"]) 
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        root.addWidget(self.table, 1)

        compare_row = QHBoxLayout()
        self.compare_a = QComboBox()
        self.compare_b = QComboBox()
        self.compare_btn = QPushButton("Compare")
        self.compare_lbl = QLabel("Select two sessions")
        compare_row.addWidget(QLabel("A:"))
        compare_row.addWidget(self.compare_a)
        compare_row.addWidget(QLabel("B:"))
        compare_row.addWidget(self.compare_b)
        compare_row.addWidget(self.compare_btn)
        compare_row.addWidget(self.compare_lbl, 1)
        root.addLayout(compare_row)

    def _bind(self) -> None:
        self.refresh_btn.clicked.connect(self.refresh_sessions)
        self.load_btn.clicked.connect(self._load_selected)
        self.export_btn.clicked.connect(self._export_selected)
        self.compare_btn.clicked.connect(self._compare)
        self.hand_filter.currentIndexChanged.connect(self._apply_filters)
        self.tag_filter.textChanged.connect(self._apply_filters)
        self.from_date.dateChanged.connect(self._apply_filters)
        self.to_date.dateChanged.connect(self._apply_filters)
        self.controller.history_updated.connect(self._on_history_update)

    def refresh_sessions(self) -> None:
        self._on_history_update(self.controller.list_sessions())

    def _on_history_update(self, sessions: Any) -> None:
        self._all = list(sessions or [])
        self._apply_filters()

    def _apply_filters(self) -> None:
        hand = self.hand_filter.currentText()
        needle = self.tag_filter.text().strip().lower()
        date_from = self.from_date.date().toPython()
        date_to = self.to_date.date().toPython()

        filtered: list[SessionMeta] = []
        for s in self._all:
            try:
                d = datetime.fromisoformat(s.started_at_iso).date()
            except Exception:
                d = date_from
            if d < date_from or d > date_to:
                continue
            if hand != "All" and s.hand != hand:
                continue
            hay = f"{s.tag} {s.notes}".lower()
            if needle and needle not in hay:
                continue
            filtered.append(s)

        self.table.setRowCount(len(filtered))
        self.compare_a.clear()
        self.compare_b.clear()
        for r, s in enumerate(filtered):
            self.table.setItem(r, 0, QTableWidgetItem(s.session_id))
            self.table.setItem(r, 1, QTableWidgetItem(s.started_at_iso))
            self.table.setItem(r, 2, QTableWidgetItem(s.hand))
            self.table.setItem(r, 3, QTableWidgetItem(str(s.efforts_count)))
            self.table.setItem(r, 4, QTableWidgetItem(f"{s.best_peak_kg:.1f}"))
            self.table.setItem(r, 5, QTableWidgetItem(s.tag))
            self.compare_a.addItem(s.session_id)
            self.compare_b.addItem(s.session_id)

    def _selected_session_id(self) -> str | None:
        rows = self.table.selectionModel().selectedRows()
        if not rows:
            return None
        row = rows[0].row()
        item = self.table.item(row, 0)
        return item.text() if item else None

    def _load_selected(self) -> None:
        sid = self._selected_session_id()
        if not sid:
            self.compare_lbl.setText("Select a row first")
            return
        payload = self.controller.load_session(sid)
        self.session_loaded.emit(payload)
        self.compare_lbl.setText(f"Loaded {sid}")

    def _export_selected(self) -> None:
        sid = self._selected_session_id()
        if not sid:
            self.compare_lbl.setText("Select a row first")
            return
        out = self.controller.export_efforts_csv(sid)
        self.compare_lbl.setText(f"Exported: {out}")

    def _compare(self) -> None:
        if self.compare_a.count() == 0 or self.compare_b.count() == 0:
            return
        a = self.compare_a.currentText()
        b = self.compare_b.currentText()
        if not a or not b:
            return
        diff = self.controller.compare_sessions(a, b)
        self.compare_lbl.setText(
            f"Peak Δ {diff['peak_total_diff_kg']:+.1f} kg | "
            f"RFD100 Δ {diff['rfd100_diff_kg_s']:+.1f} | "
            f"Imbalance Δ {diff['imbalance_diff']:+.2f} | "
            f"Stab Δ {diff['stabilization_diff_s']:+.2f}s | "
            f"Switch Δ {diff['switch_diff']:+.2f}"
        )
