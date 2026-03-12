from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtWidgets import QApplication

from persistence import SettingsStore
from ui.main_window import MainWindow
from ui.theme import apply_theme


def main() -> None:
    app = QApplication(sys.argv)
    app.setStyle("Fusion")

    app_dir = Path(__file__).resolve().parent
    settings = SettingsStore(app_dir / "data" / "settings.json").load()
    apply_theme(app, settings.ui_theme)
    win = MainWindow(app_dir=app_dir)
    win.show()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
