"""Job-Schleife: Auftrag holen → auswerten → Ergebnis verschlüsseln → speichern → Rohdaten löschen.

Garantien (per Test abgesichert):
  - Die Upload-Datei wird gelöscht, sobald ein Auftrag endet (fertig, endgültig fehlgeschlagen, Session gelöscht).
    Nur zwischen zwei Versuchen bleibt sie liegen; der Aufräumer löscht spätestens nach 24 h.
  - Zwischendateien (Audio) liegen in einem temporären Verzeichnis, das sofort wieder entfernt wird.
  - In der Datenbank landet nur das Chiffrat, nie der Klartext.
  - Wurde die Session inzwischen gelöscht, wird nichts gespeichert.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Iterable, Protocol

from .crypto import encrypt
from .engines import AsrEngine, LanguageModel, OcrEngine, TranscriptPiece
from .frames import Frame, extract_audio, read_frames
from .pipeline import PipelineInput, run_pipeline

log = logging.getLogger("guide_worker")
MAX_ATTEMPTS = 3


class Repo(Protocol):
    def claim_job(self, lock_seconds: int) -> dict | None: ...
    def get_arena(self, arena_id: str) -> dict | None: ...
    def set_progress(self, arena_id: str, progress: float) -> None: ...
    def save_result(self, arena_id: str, blob: dict) -> None: ...
    def fail_arena(self, arena_id: str, reason: str) -> None: ...
    def finish_job(self, job_id: str, state: str) -> None: ...
    def release_job(self, job_id: str) -> None: ...
    def stale_upload_paths(self, older_than: datetime) -> Iterable[tuple[str, str]]: ...
    def approved_politics_model(self) -> str | None: ...


@dataclass
class Engines:
    ocr: OcrEngine
    lm: LanguageModel
    asr: AsrEngine | None
    model_version: str


FrameReader = Callable[[str, float, float], Iterable[Frame]]


def _default_reader(path: str, fps: float, max_seconds: float) -> Iterable[Frame]:
    return read_frames(path, fps=fps, max_seconds=max_seconds)


def process_job(job: dict, repo: Repo, engines: Engines, *, fps: float = 2.0, scratch_dir: str | None = None,
                frame_reader: FrameReader = _default_reader) -> str:
    """Verarbeitet einen Auftrag. Rückgabe: "done" | "retry" | "failed" | "gone"."""
    arena_id = job["arenaSessionId"]
    upload = job["uploadPath"]
    final = job.get("attempts", 1) >= MAX_ATTEMPTS  # claim_job hat attempts bereits erhöht
    try:
        arena = repo.get_arena(arena_id)
        if arena is None:
            return "gone"
        repo.set_progress(arena_id, 0.05)
        duration_min = int(arena["durationMin"])

        transcript: list[TranscriptPiece] = []
        has_audio = False
        if engines.asr is not None:
            with tempfile.TemporaryDirectory(dir=scratch_dir) as tmp:
                wav = os.path.join(tmp, "audio.wav")
                has_audio = extract_audio(upload, wav, max_seconds=duration_min * 60)
                if has_audio:
                    transcript = engines.asr.transcribe(wav)
        repo.set_progress(arena_id, 0.3)

        result = run_pipeline(
            PipelineInput(
                frames=frame_reader(upload, fps, duration_min * 60),
                fps=fps,
                duration_min=duration_min,
                app=arena["app"],
                # Richtung nur mit Einwilligung UND für genau diese, im Admin-Tool freigegebene Modellversion (E6)
                politics_spectrum_enabled=bool(arena["consents"]["politicsSpectrum"])
                and repo.approved_politics_model() == engines.model_version,
                recording_ended_at=_iso(arena.get("recordingEndedAt")),
                transcript=transcript,
                has_audio=has_audio,
                model_version=engines.model_version,
            ),
            engines.ocr,
            engines.lm,
        )
        repo.set_progress(arena_id, 0.95)
        public_key = base64.b64decode(arena["publicKey"])
        blob = encrypt(json.dumps(result, ensure_ascii=False).encode("utf-8"), public_key)
        del result
        if repo.get_arena(arena_id) is None:  # zwischendurch gelöscht → nichts speichern
            return "gone"
        repo.save_result(arena_id, blob)
        return "done"
    except Exception as e:  # noqa: BLE001 – jeder Fehler führt zu Retry bzw. Abbruch
        log.warning("Job %s fehlgeschlagen: %s", job["_id"], type(e).__name__)
        if final:
            repo.fail_arena(arena_id, "Die Aufnahme konnte nicht ausgewertet werden. Bitte versuch es mit einer neuen Aufnahme.")
            return "failed"
        return "retry"


def _remove(path: str) -> None:
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        log.error("Upload-Datei konnte nicht gelöscht werden")


def _iso(value) -> str:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(value) if value else datetime.now(timezone.utc).isoformat()


def run_once(repo: Repo, engines: Engines, **kw) -> str | None:
    job = repo.claim_job(lock_seconds=3600)
    if job is None:
        return None
    outcome = process_job(job, repo, engines, **kw)
    if outcome == "retry":
        repo.release_job(job["_id"])  # Datei bleibt nur für den nächsten Versuch liegen
    else:
        _remove(job["uploadPath"])  # fertig, fehlgeschlagen oder Session gelöscht → Rohdaten weg
        repo.finish_job(job["_id"], "done" if outcome in ("done", "gone") else "failed")
    return outcome


def sweep(repo: Repo, max_age: timedelta = timedelta(hours=24)) -> int:
    """Aufräumer: Upload-Dateien, die älter als 24 h sind, löschen und die Session als fehlgeschlagen markieren."""
    n = 0
    for arena_id, path in repo.stale_upload_paths(datetime.now(timezone.utc) - max_age):
        _remove(path)
        repo.fail_arena(arena_id, "Die Aufnahme wurde nicht rechtzeitig ausgewertet und ist gelöscht.")
        n += 1
    return n


def loop(repo: Repo, engines: Engines, poll_seconds: float = 5.0, **kw) -> None:  # pragma: no cover – Endlosschleife
    last_sweep = 0.0
    while True:
        if time.time() - last_sweep > 600:
            sweep(repo)
            last_sweep = time.time()
        if run_once(repo, engines, **kw) is None:
            time.sleep(poll_seconds)
