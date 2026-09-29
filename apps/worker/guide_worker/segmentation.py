"""Segmentierung in einzelne Videos und Verhaltenssignale (Skip, Like, Loop, Werbung).

Grenze zwischen zwei Videos, wenn sich die „Signatur“ ändert:
  1. bevorzugt: Text in der Creator-Zone bzw. Caption (per Hash, der Text selbst wird nicht behalten)
  2. ohne Text: großer Bildwechsel im Inhaltsbereich (dHash-Abstand und Grauwert-Differenz)
Unsichere Signale werden None – sie fließen im Bericht weder positiv noch negativ ein.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Sequence

import numpy as np

from .frames import crop, dhash, hamming, mean_abs_diff
from .redaction import AppLayout, Box, OcrToken

#: Inhaltsbereich ohne Statusleiste, Aktionsleiste und Caption
CONTENT = Box(0.0, 0.1, 0.78, 0.6)
#: Herz-Symbol in der Aktionsleiste (vorläufig, wird kalibriert)
HEART_ZONES: dict[str, Box] = {
    "tiktok": Box(0.84, 0.40, 0.14, 0.08),
    "instagram_reels": Box(0.84, 0.55, 0.14, 0.07),
    "youtube_shorts": Box(0.84, 0.45, 0.14, 0.07),
    "snapchat_spotlight": Box(0.84, 0.50, 0.14, 0.07),
}
AD_RE = re.compile(r"\b(gesponsert|anzeige|werbung|sponsored|promoted|bezahlte partnerschaft|paid partnership)\b", re.I)


@dataclass
class FeedFrame:
    t: float
    image: np.ndarray  # bereits geschwärzt
    tokens: list[OcrToken]  # Original-Tokens (nur im RAM)
    creator_key: str | None
    content_hash: int


@dataclass
class RawSegment:
    frames: list[FeedFrame] = field(default_factory=list)

    @property
    def start(self) -> float:
        return self.frames[0].t

    def end(self, frame_step: float) -> float:
        return self.frames[-1].t + frame_step


def creator_key(tokens: Sequence[OcrToken], layout: AppLayout) -> str | None:
    """Hash des Texts in der Creator-Zone (Anzeigename/Handle). Ändert er sich, beginnt ein neues Video."""
    texts = sorted(
        t.text.strip().lower()
        for t in tokens
        if any(z.x <= t.box.center()[0] <= z.x + z.w and z.y <= t.box.center()[1] <= z.y + z.h for z in layout.creator_zones)
    )
    if not texts:
        return None
    return hashlib.sha256("|".join(texts).encode()).hexdigest()[:16]


def content_hash(image: np.ndarray) -> int:
    return dhash(crop(image, CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h))


def is_boundary(prev: FeedFrame, cur: FeedFrame, *, gap: bool) -> bool:
    if prev.creator_key and cur.creator_key:
        return prev.creator_key != cur.creator_key
    visual_change = hamming(prev.content_hash, cur.content_hash) > 18 and mean_abs_diff(
        crop(prev.image, CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h), crop(cur.image, CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h)
    ) > 30
    return visual_change or (gap and hamming(prev.content_hash, cur.content_hash) > 10)


def segment_frames(frames: Sequence[FeedFrame], frame_step: float) -> list[RawSegment]:
    segments: list[RawSegment] = []
    prev: FeedFrame | None = None
    for f in frames:
        gap = prev is not None and f.t - prev.t > frame_step * 1.5  # dazwischen Nicht-Feed-Frames
        if prev is None or is_boundary(prev, f, gap=gap):
            segments.append(RawSegment())
        segments[-1].frames.append(f)
        prev = f
    return segments


# ---------------------------------------------------------------------------
# Signale
# ---------------------------------------------------------------------------


def red_fraction(image: np.ndarray, zone: Box) -> float:
    region = crop(image, zone.x, zone.y, zone.w, zone.h).astype(np.int16)
    if region.size == 0:
        return 0.0
    r, g, b = region[..., 0], region[..., 1], region[..., 2]
    red = (r > 180) & (g < 90) & (b < 120)
    return float(red.mean())


def detect_like(seg: RawSegment, app: str, calibrated: bool) -> bool | None:
    zone = HEART_ZONES.get(app)
    if zone is None or not calibrated:
        return None
    hits = sum(1 for f in seg.frames if red_fraction(f.image, zone) > 0.06)
    return hits >= 1


def count_loops(seg: RawSegment, frame_step: float, min_gap_s: float = 3.0, same: int = 6) -> int | None:
    """Wie oft taucht das Startbild wieder auf, nachdem sich das Bild zwischendurch verändert hat?"""
    if len(seg.frames) < 4:
        return 0
    start = seg.frames[0].content_hash
    loops = 0
    changed = False
    last_loop_t = seg.frames[0].t
    for f in seg.frames[1:]:
        d = hamming(start, f.content_hash)
        if d > same * 2:
            changed = True
        elif d <= same and changed and f.t - last_loop_t >= min_gap_s:
            loops += 1
            changed = False
            last_loop_t = f.t
    if not changed and loops == 0 and seg.frames[-1].t - seg.frames[0].t > 20:
        return None  # durchgehend gleiches Bild (z. B. Standbild-Video): Loop nicht erkennbar
    return loops


def is_ad(seg: RawSegment) -> bool:
    return any(AD_RE.search(t.text) for f in seg.frames for t in f.tokens)
