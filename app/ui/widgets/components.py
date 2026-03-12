from __future__ import annotations

from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QVBoxLayout,
    QWidget,
)


class SecondaryButton(QPushButton):
    def __init__(self, text: str, parent=None):
        super().__init__(text, parent)
        self.setProperty("role", "secondary")


class PrimaryButton(QPushButton):
    def __init__(self, text: str, parent=None):
        super().__init__(text, parent)
        self.setProperty("role", "primary")


class StatusChip(QLabel):
    def __init__(self, label: str = "", parent=None):
        super().__init__(label, parent)
        self.setFrameShape(QFrame.NoFrame)
        self.setStyleSheet(
            "padding: 4px 10px; border-radius: 10px; "
            "border: 1px solid #d9e1ec; background: #eef3fa; color: #10233d; font-weight: 700;"
        )
        self.set_state(label or "Idle", "neutral")

    def set_state(self, label: str, tone: str) -> None:
        style = {
            "ok": "background:#dff6e9; border:1px solid #b9e9cf; color:#166a42;",
            "warn": "background:#fff4dc; border:1px solid #f0d79d; color:#8a5c06;",
            "bad": "background:#ffe6e8; border:1px solid #f3bec5; color:#a03c49;",
            "neutral": "background:#eef3fa; border:1px solid #d9e1ec; color:#23384f;",
        }.get(tone, "background:#eef3fa; border:1px solid #d9e1ec; color:#23384f;")
        self.setText(label)
        self.setStyleSheet(
            f"padding: 4px 10px; border-radius: 10px; font-weight: 700; {style}"
        )


class SectionPanel(QFrame):
    def __init__(self, title: str, subtitle: str = "", parent=None):
        super().__init__(parent)
        self.setObjectName("SectionPanel")
        root = QVBoxLayout(self)
        root.setContentsMargins(12, 10, 12, 12)
        root.setSpacing(8)

        header = QVBoxLayout()
        header.setSpacing(2)
        self.title_lbl = QLabel(title)
        self.title_lbl.setObjectName("SectionTitle")
        header.addWidget(self.title_lbl)

        self.subtitle_lbl = QLabel(subtitle)
        self.subtitle_lbl.setObjectName("SectionSubtitle")
        self.subtitle_lbl.setVisible(bool(subtitle))
        header.addWidget(self.subtitle_lbl)
        root.addLayout(header)

        self._body = QVBoxLayout()
        self._body.setSpacing(8)
        root.addLayout(self._body, 1)

    @property
    def body(self) -> QVBoxLayout:
        return self._body

    def set_subtitle(self, subtitle: str) -> None:
        self.subtitle_lbl.setText(subtitle)
        self.subtitle_lbl.setVisible(bool(subtitle))


class StatCard(QFrame):
    def __init__(self, title: str, value: str = "0.0", subtitle: str = "", parent=None):
        super().__init__(parent)
        self.setObjectName("StatCard")

        root = QVBoxLayout(self)
        root.setContentsMargins(12, 10, 12, 10)
        root.setSpacing(4)

        self.title_lbl = QLabel(title)
        self.title_lbl.setObjectName("StatTitle")
        root.addWidget(self.title_lbl)

        self.value_lbl = QLabel(value)
        self.value_lbl.setObjectName("StatValue")
        root.addWidget(self.value_lbl)

        self.subtitle_lbl = QLabel(subtitle)
        self.subtitle_lbl.setObjectName("StatSubtle")
        self.subtitle_lbl.setVisible(bool(subtitle))
        root.addWidget(self.subtitle_lbl)

    def set_title(self, title: str) -> None:
        self.title_lbl.setText(title)

    def set_value(self, value: str) -> None:
        self.value_lbl.setText(value)

    def set_subtitle(self, subtitle: str) -> None:
        self.subtitle_lbl.setText(subtitle)
        self.subtitle_lbl.setVisible(bool(subtitle))

    def set_accent(self, color: str) -> None:
        self.value_lbl.setStyleSheet(f"font-size: 26px; font-weight: 800; color: {color};")


class MetricRow(QWidget):
    def __init__(self, label: str, value: str = "-", parent=None):
        super().__init__(parent)
        row = QHBoxLayout(self)
        row.setContentsMargins(0, 0, 0, 0)
        row.setSpacing(8)

        self.label_lbl = QLabel(label)
        self.label_lbl.setObjectName("StatTitle")
        row.addWidget(self.label_lbl, 1)

        self.value_lbl = QLabel(value)
        self.value_lbl.setStyleSheet("font-weight: 700; color:#10233d;")
        row.addWidget(self.value_lbl, 0)

    def set_value(self, value: str) -> None:
        self.value_lbl.setText(value)

