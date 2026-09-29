"""Integration mit echter MongoDB (läuft nur mit MONGODB_TEST_URI, z. B. in CI mit Mongo-Service)."""

import base64
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from guide_worker.crypto import decrypt, derive_identity
from guide_worker.runner import Engines, run_once, sweep

from .synthetic import FakeLm, FakeOcr, Scenario, Video

URI = os.environ.get("MONGODB_TEST_URI")
pytestmark = pytest.mark.skipif(not URI, reason="MONGODB_TEST_URI nicht gesetzt")


@pytest.fixture
def repo():
    from guide_worker.mongo_repo import MongoRepo

    db = f"guide_test_{uuid.uuid4().hex[:8]}"
    r = MongoRepo(URI, db)
    yield r
    r._db.client.drop_database(db)


def seed(repo, tmp_path, created=None):
    ident = derive_identity(os.urandom(16))
    path = tmp_path / f"{uuid.uuid4()}.upload"
    path.write_bytes(b"x" * 10)
    now = datetime.now(timezone.utc)
    repo.arenas.insert_one({
        "_id": ident.retrieval_id, "publicKey": base64.b64encode(ident.public_key).decode(), "durationMin": 15,
        "app": "tiktok", "consents": {"analysis": True, "politicsSpectrum": True, "guardianConfirmed": False},
        "status": "queued", "upload": {"size": 10, "received": 10, "mimeType": "video/mp4", "path": str(path)},
        "recordingEndedAt": now, "createdAt": created or now, "expiresAt": now + timedelta(days=7), "result": None,
    })
    repo.jobs.insert_one({"_id": str(uuid.uuid4()), "arenaSessionId": ident.retrieval_id, "uploadPath": str(path),
                          "state": "queued", "attempts": 0, "createdAt": now, "expiresAt": now + timedelta(days=1)})
    return ident, path


def test_full_job_against_mongo(repo, tmp_path):
    ident, path = seed(repo, tmp_path)
    videos = [Video("a_b", "Pasta in fünf Minuten", 8, category="food"), Video("c_d", "Wahlprogramm", 8, category="politics", spectrum="left")]
    frames, tokens = Scenario(items=videos).build()
    engines = Engines(FakeOcr(tokens), FakeLm(videos), None, "fake")
    assert run_once(repo, engines, frame_reader=lambda *a: iter(frames)) == "done"
    doc = repo.get_arena(ident.retrieval_id)
    assert doc["status"] == "ready" and doc["upload"] is None and doc["progress"] == 1
    assert "Pasta" not in json.dumps(doc["result"])
    result = json.loads(decrypt(doc["result"], ident.private_key))
    assert result["segments"][1]["spectrum"] == "left"
    assert not path.exists()
    job = repo.jobs.find_one({"arenaSessionId": ident.retrieval_id})
    assert job["state"] == "done" and job["uploadPath"] is None and job["attempts"] == 1
    assert run_once(repo, engines, frame_reader=lambda *a: iter(frames)) is None


def test_sweeper_against_mongo(repo, tmp_path):
    ident, path = seed(repo, tmp_path, created=datetime.now(timezone.utc) - timedelta(hours=30))
    assert sweep(repo) == 1
    assert not path.exists()
    assert repo.get_arena(ident.retrieval_id)["status"] == "failed"
