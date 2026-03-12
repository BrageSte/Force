from __future__ import annotations

import pyqtgraph as pg
from PySide6.QtGui import QFont
from PySide6.QtWidgets import QApplication

THEME_NAME_LIGHT_CLEAN = "light_clean"

PALETTE = {
    "bg": "#f4f6fb",
    "surface": "#ffffff",
    "surface_alt": "#f8fafc",
    "border": "#d9e1ec",
    "text": "#10233d",
    "muted": "#5c6f89",
    "primary": "#0b84f3",
    "success": "#15a15d",
    "warning": "#f0a31a",
    "danger": "#e04f5f",
}

SPACING = {
    "xs": 6,
    "sm": 10,
    "md": 14,
    "lg": 18,
    "xl": 24,
}

RADIUS = {
    "sm": 8,
    "md": 12,
    "lg": 16,
}

FONT_SIZE = {
    "caption": 11,
    "body": 13,
    "title": 16,
    "headline": 26,
}


def app_stylesheet(theme_name: str = THEME_NAME_LIGHT_CLEAN) -> str:
    if theme_name != THEME_NAME_LIGHT_CLEAN:
        theme_name = THEME_NAME_LIGHT_CLEAN

    p = PALETTE
    r = RADIUS
    s = SPACING
    f = FONT_SIZE
    return f"""
QWidget {{
    background: {p["bg"]};
    color: {p["text"]};
    font-size: {f["body"]}px;
}}

QMainWindow {{
    background: {p["bg"]};
}}

QFrame#AppShell {{
    background: {p["bg"]};
}}

QFrame#Sidebar {{
    background: {p["surface"]};
    border: 1px solid {p["border"]};
    border-radius: {r["lg"]}px;
}}

QFrame#Topbar {{
    background: {p["surface"]};
    border: 1px solid {p["border"]};
    border-radius: {r["lg"]}px;
}}

QFrame#SectionPanel {{
    background: {p["surface"]};
    border: 1px solid {p["border"]};
    border-radius: {r["md"]}px;
}}

QLabel#SectionTitle {{
    font-size: {f["title"]}px;
    font-weight: 700;
    color: {p["text"]};
}}

QLabel#SectionSubtitle {{
    font-size: {f["caption"]}px;
    color: {p["muted"]};
}}

QFrame#StatCard {{
    background: {p["surface"]};
    border: 1px solid {p["border"]};
    border-radius: {r["md"]}px;
}}

QLabel#StatTitle {{
    font-size: {f["caption"]}px;
    color: {p["muted"]};
    font-weight: 600;
}}

QLabel#StatValue {{
    font-size: {f["headline"]}px;
    font-weight: 800;
    color: {p["text"]};
}}

QLabel#StatSubtle {{
    font-size: {f["caption"]}px;
    color: {p["muted"]};
}}

QPushButton {{
    border: 1px solid {p["border"]};
    background: {p["surface_alt"]};
    border-radius: {r["sm"]}px;
    padding: {s["xs"]}px {s["md"]}px;
    font-weight: 600;
    color: {p["text"]};
}}

QPushButton:hover {{
    background: #eef3fa;
}}

QPushButton:pressed {{
    background: #e5edf8;
}}

QPushButton:checked {{
    background: #dce9f9;
    border-color: #b8d2f5;
}}

QPushButton[role="primary"] {{
    background: {p["primary"]};
    border-color: {p["primary"]};
    color: #ffffff;
}}

QPushButton[role="primary"]:hover {{
    background: #0879df;
}}

QPushButton[role="danger"] {{
    color: {p["danger"]};
}}

QComboBox,
QLineEdit,
QSpinBox,
QDoubleSpinBox,
QDateEdit,
QTableWidget,
QListWidget {{
    background: {p["surface"]};
    border: 1px solid {p["border"]};
    border-radius: {r["sm"]}px;
    padding: {s["xs"]}px;
    selection-background-color: #dce9f9;
    selection-color: {p["text"]};
}}

QGroupBox {{
    border: 1px solid {p["border"]};
    border-radius: {r["md"]}px;
    margin-top: {s["md"]}px;
    padding: {s["md"]}px;
    background: {p["surface"]};
    font-weight: 700;
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 {s["xs"]}px;
    color: {p["text"]};
}}

QHeaderView::section {{
    background: {p["surface_alt"]};
    color: {p["muted"]};
    border: 1px solid {p["border"]};
    padding: {s["xs"]}px;
    font-weight: 700;
}}

QStatusBar {{
    background: {p["surface"]};
    border-top: 1px solid {p["border"]};
}}
"""


def apply_theme(app: QApplication, theme_name: str = THEME_NAME_LIGHT_CLEAN) -> str:
    if theme_name != THEME_NAME_LIGHT_CLEAN:
        theme_name = THEME_NAME_LIGHT_CLEAN

    app.setStyleSheet(app_stylesheet(theme_name))
    app.setFont(QFont("Avenir Next", FONT_SIZE["body"]))

    pg.setConfigOptions(antialias=True, background=PALETTE["surface"], foreground=PALETTE["text"])
    return theme_name

