from __future__ import annotations

from dataclasses import dataclass

from PySide6.QtCore import QObject, Signal


@dataclass(slots=True)
class AcquisitionSample:
    """One sample from a source (serial/simulator)."""

    t_ms: int
    values: tuple[float, float, float, float]


class DataSource(QObject):
    """Abstract data source with Qt signals."""

    sample_received = Signal(object)  # AcquisitionSample
    status_message = Signal(str)
    connection_changed = Signal(bool)

    def start(self) -> None:
        raise NotImplementedError

    def stop(self) -> None:
        raise NotImplementedError

    def is_running(self) -> bool:
        raise NotImplementedError

    def send_command(self, cmd: str) -> None:
        """Optional command channel (serial firmware)."""

    def trigger_max_pull(self) -> None:
        """Optional for simulator."""

    def trigger_hang(self) -> None:
        """Optional for simulator."""
