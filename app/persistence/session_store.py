from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class SessionMeta:
    session_id: str
    started_at_iso: str
    hand: str
    efforts_count: int
    best_peak_kg: float
    path: str
    tag: str = ""
    notes: str = ""


class SessionStore:
    def __init__(self, sessions_dir: Path):
        self.sessions_dir = sessions_dir
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

    def save_session(self, session_payload: dict[str, Any]) -> Path:
        session_id = str(session_payload["session_id"])
        out = self.sessions_dir / f"{session_id}.json"
        out.write_text(json.dumps(session_payload, indent=2, ensure_ascii=True), encoding="utf-8")
        return out

    def load_session(self, session_id: str) -> dict[str, Any]:
        path = self.sessions_dir / f"{session_id}.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def list_sessions(self) -> list[SessionMeta]:
        metas: list[SessionMeta] = []
        for path in sorted(self.sessions_dir.glob("*.json"), reverse=True):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                summary = payload.get("summary", {})
                metas.append(
                    SessionMeta(
                        session_id=str(payload.get("session_id", path.stem)),
                        started_at_iso=str(payload.get("started_at_iso", "")),
                        hand=str(payload.get("hand", "Right")),
                        efforts_count=int(summary.get("efforts_count", len(payload.get("efforts", [])))),
                        best_peak_kg=float(summary.get("best_peak_kg", 0.0)),
                        path=str(path),
                        tag=str(payload.get("tag", "")),
                        notes=str(payload.get("notes", "")),
                    )
                )
            except Exception:
                continue
        return metas

    def export_efforts_csv(self, session_payload: dict[str, Any], out_path: Path | None = None) -> Path:
        session_id = str(session_payload.get("session_id", "session"))
        if out_path is None:
            out_path = self.sessions_dir / f"{session_id}_efforts.csv"

        efforts = session_payload.get("efforts", [])
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "effort_id",
                    "start_t_ms",
                    "duration_s",
                    "peak_total_kg",
                    "peak_index_kg",
                    "peak_middle_kg",
                    "peak_ring_kg",
                    "peak_pinky_kg",
                    "avg_total_kg",
                    "tut_s",
                    "rfd_100_kg_s",
                    "rfd_200_kg_s",
                    "rfd_100_n_s",
                    "rfd_200_n_s",
                    "imbalance_index",
                    "load_variation_cv",
                    "dominant_switch_count",
                    "load_shift_rate",
                    "stabilization_time_s",
                    "ring_pinky_share",
                ]
            )
            for e in efforts:
                peaks = e.get("peak_per_finger_kg", [0, 0, 0, 0])
                writer.writerow(
                    [
                        e.get("effort_id", ""),
                        e.get("start_t_ms", ""),
                        e.get("duration_s", ""),
                        e.get("peak_total_kg", ""),
                        peaks[0],
                        peaks[1],
                        peaks[2],
                        peaks[3],
                        e.get("avg_total_kg", ""),
                        e.get("tut_s", ""),
                        e.get("rfd_100_kg_s", ""),
                        e.get("rfd_200_kg_s", ""),
                        e.get("rfd_100_n_s", ""),
                        e.get("rfd_200_n_s", ""),
                        e.get("finger_imbalance_index", ""),
                        e.get("load_variation_cv", ""),
                        e.get("dominant_switch_count", ""),
                        e.get("load_shift_rate", ""),
                        e.get("stabilization_time_s", ""),
                        e.get("ring_pinky_share", ""),
                    ]
                )
        return out_path
