from __future__ import annotations

import threading
import time
from threading import current_thread

import serial
import serial.tools.list_ports

from .base import DataSource
from .parsing import parse_sample_line, status_message_from_line


class SerialDataSource(DataSource):
    """Reads newline-delimited CSV/JSON samples from Arduino over USB serial."""

    def __init__(self, port: str = "", baud: int = 115200, parent=None):
        super().__init__(parent)
        self._port_name = port
        self._baud = baud
        self._serial: serial.Serial | None = None
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    @staticmethod
    def list_ports() -> list[str]:
        return [p.device for p in serial.tools.list_ports.comports()]

    def configure(self, port: str, baud: int) -> None:
        self._port_name = port
        self._baud = baud

    def start(self) -> None:
        if self.is_running():
            return
        if not self._port_name:
            self.status_message.emit("No serial port selected")
            return

        try:
            self._serial = serial.Serial(self._port_name, self._baud, timeout=0.1)
            self._serial.reset_input_buffer()
        except Exception as exc:  # pragma: no cover - hardware path
            self._serial = None
            self.status_message.emit(f"Serial open failed: {exc}")
            self.connection_changed.emit(False)
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._read_loop, name="serial-source", daemon=True)
        self._thread.start()
        self.connection_changed.emit(True)
        self.status_message.emit(f"Connected: {self._port_name} @ {self._baud}")

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive() and current_thread() is not self._thread:
            self._thread.join(timeout=1.5)

        if self._serial is not None:
            try:
                self._serial.close()
            except Exception:
                pass
            self._serial = None

        self._thread = None
        self.connection_changed.emit(False)

    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def send_command(self, cmd: str) -> None:
        if self._serial is None or not self._serial.is_open:
            return
        try:
            self._serial.write((cmd.strip() + "\n").encode("ascii", errors="ignore"))
        except Exception:
            pass

    def _read_loop(self) -> None:  # pragma: no cover - exercised manually with hardware
        while not self._stop_event.is_set():
            if self._serial is None or not self._serial.is_open:
                time.sleep(0.05)
                continue
            try:
                raw = self._serial.readline()
                if not raw:
                    continue
                line = raw.decode("utf-8", errors="ignore").strip()
                if not line:
                    continue
                status = status_message_from_line(line)
                if status is not None:
                    self.status_message.emit(status)
                    continue
                sample = parse_sample_line(line, int(time.monotonic() * 1000))
                if sample is None:
                    self.status_message.emit(f"Parse skipped: {line[:120]}")
                    continue
                self.sample_received.emit(sample)
            except Exception as exc:
                self.status_message.emit(f"Serial read error: {exc}")
                break

        if self._serial is not None:
            try:
                self._serial.close()
            except Exception:
                pass
            self._serial = None
        self._thread = None
        self.connection_changed.emit(False)
