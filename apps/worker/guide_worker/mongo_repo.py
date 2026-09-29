"""MongoDB-Anbindung des Workers (gleiche Collections wie apps/web/src/server/mongoStore.ts)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

from pymongo import MongoClient, ReturnDocument  # type: ignore[import-not-found]


class MongoRepo:
    def __init__(self, uri: str, db: str):
        self._db = MongoClient(uri, appname="guide-me-worker")[db]
        self.arenas = self._db["arenaSessions"]
        self.jobs = self._db["jobs"]

    def claim_job(self, lock_seconds: int) -> dict | None:
        now = datetime.now(timezone.utc)
        job = self.jobs.find_one_and_update(
            {"$or": [{"state": "queued"}, {"state": "running", "lockedUntil": {"$lt": now}}]},
            {"$set": {"state": "running", "lockedUntil": now + timedelta(seconds=lock_seconds)}, "$inc": {"attempts": 1}},
            sort=[("createdAt", 1)],
            return_document=ReturnDocument.AFTER,
        )
        if job:
            self.arenas.update_one({"_id": job["arenaSessionId"]}, {"$set": {"status": "processing", "progress": 0.01}})
        return job

    def get_arena(self, arena_id: str) -> dict | None:
        return self.arenas.find_one({"_id": arena_id})

    def set_progress(self, arena_id: str, progress: float) -> None:
        self.arenas.update_one({"_id": arena_id}, {"$set": {"progress": progress}})

    def save_result(self, arena_id: str, blob: dict) -> None:
        self.arenas.update_one({"_id": arena_id}, {"$set": {"status": "ready", "progress": 1, "result": blob, "upload": None}})

    def fail_arena(self, arena_id: str, reason: str) -> None:
        self.arenas.update_one({"_id": arena_id}, {"$set": {"status": "failed", "failureReason": reason, "upload": None}})

    def finish_job(self, job_id: str, state: str) -> None:
        self.jobs.update_one({"_id": job_id}, {"$set": {"state": state, "lockedUntil": None, "uploadPath": None}})

    def release_job(self, job_id: str) -> None:
        self.jobs.update_one({"_id": job_id}, {"$set": {"state": "queued", "lockedUntil": None}})

    def stale_upload_paths(self, older_than: datetime) -> Iterable[tuple[str, str]]:
        cursor = self.arenas.find(
            {"upload": {"$ne": None}, "createdAt": {"$lt": older_than}, "status": {"$in": ["uploading", "queued", "processing"]}},
            {"upload.path": 1},
        )
        for doc in cursor:
            yield doc["_id"], doc["upload"]["path"]
