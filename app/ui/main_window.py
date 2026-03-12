from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QPushButton,
    QScrollArea,
    QStackedWidget,
    QStatusBar,
    QVBoxLayout,
    QWidget,
)

from ui.tabs import CalibrationSettingsTab, HistoryTab, LiveTab, SessionAnalysisTab, TestTab
from ui.viewmodels import AppController
from ui.widgets import StatusChip


class MainWindow(QMainWindow):
    def __init__(self, app_dir: Path):
        super().__init__()
        self.setWindowTitle("Finger Force Analyzer v1")
        self.resize(1500, 950)

        self.controller = AppController(app_dir=app_dir)

        self._nav_buttons: list[QPushButton] = []

        self.live_tab = LiveTab(self.controller)
        self.test_tab = TestTab(self.controller)
        self.session_tab = SessionAnalysisTab(self.controller)
        self.history_tab = HistoryTab(self.controller)
        self.calib_tab = CalibrationSettingsTab(self.controller)

        self._pages = [
            ("LIVE", self.live_tab),
            ("TEST", self.test_tab),
            ("OKTANALYSE", self.session_tab),
            ("HISTORIKK", self.history_tab),
            ("KALIBRERING", self.calib_tab),
        ]

        self._build_shell()

        self.history_tab.session_loaded.connect(self._on_session_loaded)

        self.status = QStatusBar()
        self.setStatusBar(self.status)
        self.controller.status_message.connect(self.status.showMessage)
        self.controller.live_updated.connect(self._on_live_update)
        self.controller.connection_changed.connect(self._on_connection)
        self.controller.recording_changed.connect(self._on_recording)

        self._set_page(0)
        self._on_connection(False)
        self._on_recording(False)

    def _build_shell(self) -> None:
        root = QFrame()
        root.setObjectName("AppShell")
        root_layout = QHBoxLayout(root)
        root_layout.setContentsMargins(14, 14, 14, 14)
        root_layout.setSpacing(12)

        sidebar = QFrame()
        sidebar.setObjectName("Sidebar")
        sidebar.setFixedWidth(220)
        side_layout = QVBoxLayout(sidebar)
        side_layout.setContentsMargins(12, 12, 12, 12)
        side_layout.setSpacing(8)

        brand = QLabel("Finger Force")
        brand.setStyleSheet("font-size: 20px; font-weight: 800;")
        side_layout.addWidget(brand)

        subtitle = QLabel("Dashboard v1")
        subtitle.setStyleSheet("color:#5c6f89; font-weight:600;")
        side_layout.addWidget(subtitle)
        side_layout.addSpacing(8)

        for idx, (name, _page) in enumerate(self._pages):
            btn = QPushButton(name)
            btn.setCheckable(True)
            btn.setCursor(Qt.PointingHandCursor)
            btn.setMinimumHeight(38)
            btn.clicked.connect(lambda _checked, i=idx: self._set_page(i))
            side_layout.addWidget(btn)
            self._nav_buttons.append(btn)

        side_layout.addStretch(1)
        hint = QLabel("Light Clean UI")
        hint.setStyleSheet("color:#5c6f89; font-size:11px;")
        side_layout.addWidget(hint)

        root_layout.addWidget(sidebar, 0)

        main_col = QVBoxLayout()
        main_col.setSpacing(10)
        main_col.setContentsMargins(0, 0, 0, 0)

        topbar = QFrame()
        topbar.setObjectName("Topbar")
        top_layout = QHBoxLayout(topbar)
        top_layout.setContentsMargins(12, 10, 12, 10)
        top_layout.setSpacing(10)

        title = QLabel("Professional Finger Force Dashboard")
        title.setStyleSheet("font-size: 18px; font-weight: 800;")
        top_layout.addWidget(title)
        top_layout.addStretch(1)

        self.connection_chip = StatusChip("Disconnected")
        self.sample_rate_chip = StatusChip("0.0 Hz")
        self.recording_chip = StatusChip("Idle")
        top_layout.addWidget(self.connection_chip)
        top_layout.addWidget(self.sample_rate_chip)
        top_layout.addWidget(self.recording_chip)

        main_col.addWidget(topbar, 0)

        self.stack = QStackedWidget()
        for name, page in self._pages:
            if name == "LIVE":
                self.stack.addWidget(page)
                continue
            wrapped = self._wrap_scroll_page(page)
            self.stack.addWidget(wrapped)
        main_col.addWidget(self.stack, 1)

        host = QWidget()
        host.setLayout(main_col)
        root_layout.addWidget(host, 1)

        self.setCentralWidget(root)

    def _wrap_scroll_page(self, page: QWidget) -> QScrollArea:
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)

        host = QWidget()
        lay = QVBoxLayout(host)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(page)
        scroll.setWidget(host)
        return scroll

    def _set_page(self, index: int) -> None:
        if index < 0 or index >= len(self._pages):
            return
        self.stack.setCurrentIndex(index)
        for i, btn in enumerate(self._nav_buttons):
            btn.setChecked(i == index)

    def _on_session_loaded(self, payload: dict) -> None:
        self.session_tab.load_session_payload(payload)
        self._set_page(2)

    def _on_connection(self, connected: bool) -> None:
        if connected:
            self.connection_chip.set_state("Connected", "ok")
        else:
            self.connection_chip.set_state("Disconnected", "bad")

    def _on_recording(self, recording: bool) -> None:
        if recording:
            self.recording_chip.set_state("Recording", "warn")
        else:
            self.recording_chip.set_state("Idle", "neutral")

    def _on_live_update(self, payload: dict) -> None:
        sr = float(payload.get("sample_rate_hz", 0.0))
        self.sample_rate_chip.set_state(f"{sr:.1f} Hz", "neutral")
        if bool(payload.get("connected", False)):
            source = self.controller.source_kind
            self.connection_chip.set_state(f"Connected ({source})", "ok")
        else:
            self.connection_chip.set_state("Disconnected", "bad")

    def closeEvent(self, event):
        self.controller.shutdown()
        super().closeEvent(event)
