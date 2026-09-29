import base64
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from guide_worker.crypto import decrypt, derive_identity
from guide_worker.runner import MAX_ATTEMPTS, Engines, run_once, sweep

from .synthetic import FakeLm, FakeOcr, Scenario, Video

IDENT = derive_identity(bytes(range(16)))


class FakeRepo:
    def __init__(self, upload_path: str, attempts: int = 0):
        self.arena = {
            "_id": IDENT.retrieval_id,
            "publicKey": base64.b64encode(IDENT.public_key).decode(),
            "durationMin": 15,
            "app": "tiktok",
            "consents": {"politicsSpectrum": False},
            "recordingEndedAt": datetime(2026, 9, 30, 8, 0, tzinfo=timezone.utc),
            "status": "queued",
            "createdAt": datetime.now(timezone.utc),
            "upload": {"path": upload_path},
        }
        self.job = {"_id": "j1", "arenaSessionId": IDENT.retrieval_id, "uploadPath": upload_path, "state": "queued", "attempts": attempts}
        self.progress: list[float] = []
        self.deleted = False
        self.approved_model: str | None = "fake"

    def approved_politics_model(self):
        return self.approved_model

    def claim_job(self, lock_seconds):
        if self.job["state"] != "queued":
            return None
        self.job["state"] = "running"
        self.job["attempts"] += 1
        return dict(self.job)

    def get_arena(self, arena_id):
        return None if self.deleted else self.arena

    def set_progress(self, arena_id, p):
        self.progress.append(p)

    def save_result(self, arena_id, blob):
        self.arena.update(status="ready", result=blob, upload=None)

    def fail_arena(self, arena_id, reason):
        self.arena.update(status="failed", failureReason=reason, upload=None)

    def finish_job(self, job_id, state):
        self.job["state"] = state

    def release_job(self, job_id):
        self.job["state"] = "queued"

    def stale_upload_paths(self, older_than):
        if self.arena["upload"] and self.arena["createdAt"] < older_than:
            yield self.arena["_id"], self.arena["upload"]["path"]


def engines_and_reader():
    videos = [Video("a_b", "Pasta in fünf Minuten", 8, category="food"), Video("c_d", "Katzen-Fails", 6, category="animals")]
    frames, tokens = Scenario(items=videos).build()
    engines = Engines(ocr=FakeOcr(tokens), lm=FakeLm(videos), asr=None, model_version="fake")
    return engines, (lambda path, fps, max_s: iter(frames))


def upload(tmp_path: Path) -> str:
    p = tmp_path / "x.upload"
    p.write_bytes(b"\x00" * 100)
    return str(p)


def test_success_stores_only_ciphertext_and_deletes_upload(tmp_path):
    path = upload(tmp_path)
    repo = FakeRepo(path)
    engines, reader = engines_and_reader()
    assert run_once(repo, engines, frame_reader=reader) == "done"
    assert not Path(path).exists()
    assert repo.arena["status"] == "ready"
    blob = repo.arena["result"]
    assert "Pasta" not in json.dumps(blob)
    result = json.loads(decrypt(blob, IDENT.private_key))
    assert len(result["segments"]) == 2
    assert result["meta"]["recordingEndedAt"].startswith("2026-09-30T08:00:00")
    assert repo.job["state"] == "done"
    assert repo.progress[-1] == 0.95


class BrokenLm(FakeLm):
    def classify(self, ev, with_spectrum):
        raise RuntimeError("Modell nicht erreichbar")


def test_retry_keeps_file_until_last_attempt(tmp_path):
    path = upload(tmp_path)
    repo = FakeRepo(path)
    engines, reader = engines_and_reader()
    engines.lm = BrokenLm([])
    for attempt in range(1, MAX_ATTEMPTS):
        assert run_once(repo, engines, frame_reader=reader) == "retry"
        assert Path(path).exists(), attempt
        assert repo.job["state"] == "queued"
    assert run_once(repo, engines, frame_reader=reader) == "failed"
    assert not Path(path).exists()
    assert repo.arena["status"] == "failed"
    assert repo.job["state"] == "failed"


def test_deleted_session_saves_nothing(tmp_path):
    path = upload(tmp_path)
    repo = FakeRepo(path)
    repo.deleted = True
    engines, reader = engines_and_reader()
    assert run_once(repo, engines, frame_reader=reader) == "gone"
    assert "result" not in repo.arena
    assert not Path(path).exists()


def test_politics_spectrum_needs_consent_and_approved_model(tmp_path):
    engines, reader = engines_and_reader()
    for consent, approved, expected in [(True, "fake", True), (True, "anderes-modell", False), (True, None, False), (False, "fake", False)]:
        repo = FakeRepo(upload(tmp_path))
        repo.arena["consents"]["politicsSpectrum"] = consent
        repo.approved_model = approved
        assert run_once(repo, engines, frame_reader=reader) == "done"
        result = json.loads(decrypt(repo.arena["result"], IDENT.private_key))
        assert result["meta"]["politicsSpectrumEnabled"] is expected, (consent, approved)


def test_no_job_returns_none(tmp_path):
    repo = FakeRepo(upload(tmp_path))
    repo.job["state"] = "done"
    engines, reader = engines_and_reader()
    assert run_once(repo, engines, frame_reader=reader) is None


def test_sweeper_deletes_stale_uploads(tmp_path):
    path = upload(tmp_path)
    repo = FakeRepo(path)
    repo.arena["createdAt"] = datetime.now(timezone.utc) - timedelta(hours=25)
    assert sweep(repo) == 1
    assert not Path(path).exists()
    assert repo.arena["status"] == "failed"
