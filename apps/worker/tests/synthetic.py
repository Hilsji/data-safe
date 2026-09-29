"""Synthetische Aufnahmen für Tests – ohne echte App-Inhalte.

Jedes „Video“ hat ein eigenes Zufallsmuster, einen Creator-Namen, eine Caption und die typische Aktionsleiste.
Dazwischen können Nicht-Feed-Screens (DM, Tastatur) liegen, und der eigene Account-Name steht dauerhaft unten rechts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

import numpy as np

from guide_worker.engines import Classification, DraftQuestion, SegmentEvidence
from guide_worker.frames import Frame
from guide_worker.redaction import Box, OcrToken

W, H = 180, 320


@dataclass
class Video:
    creator: str
    caption: str
    seconds: float
    category: str = "comedy"
    spectrum: str | None = None
    liked: bool = False
    loop_period: float | None = None  # Sekunden bis zur Wiederholung
    dog: bool = False
    ad: bool = False


@dataclass
class OffFeed:
    kind: str  # "inbox" | "keyboard"
    seconds: float


@dataclass
class Scenario:
    items: list = field(default_factory=list)
    fps: float = 2.0
    own_account: str = "jonas_privat"

    def build(self) -> tuple[list[Frame], dict[int, list[OcrToken]]]:
        frames: list[Frame] = []
        tokens: dict[int, list[OcrToken]] = {}
        t = 0.0
        step = 1 / self.fps
        for idx, item in enumerate(self.items):
            n = max(1, int(round(item.seconds * self.fps)))
            for k in range(n):
                local_t = k * step
                if isinstance(item, OffFeed):
                    img = np.full((H, W, 3), 240, dtype=np.uint8)
                    toks = _offfeed_tokens(item.kind)
                else:
                    img = _video_image(idx, item, local_t)
                    toks = _feed_tokens(item, self.own_account)
                frames.append(Frame(round(t, 3), img))
                tokens[id(img)] = toks
                t += step
        return frames, tokens


def _video_image(idx: int, v: Video, local_t: float) -> np.ndarray:
    rng = np.random.default_rng(1000 + idx)
    base = rng.integers(0, 255, (16, 9, 3), dtype=np.uint8)
    if v.loop_period:
        phase = int((local_t % v.loop_period) / v.loop_period * 4)
        base = np.roll(base, phase * 4, axis=0) if phase else base
        if phase:
            base = (255 - base).astype(np.uint8)
    img = np.kron(base, np.ones((H // 16, W // 9, 1), dtype=np.uint8))
    img = np.pad(img, ((0, H - img.shape[0]), (0, W - img.shape[1]), (0, 0)), mode="edge")
    # Statusleiste mit Uhrzeit (hell) – muss im Standbild schwarz sein
    img[: int(H * 0.06)] = 250
    if v.liked and local_t >= 1.0:
        y0, x0 = int(H * 0.42), int(W * 0.87)
        img[y0 : y0 + 12, x0 : x0 + 12] = [230, 30, 60]
    return img


def _feed_tokens(v: Video, own: str) -> list[OcrToken]:
    toks = [
        OcrToken("10:42", Box(0.05, 0.01, 0.15, 0.03)),
        OcrToken("Für dich", Box(0.4, 0.07, 0.2, 0.03)),
        OcrToken("12,3K", Box(0.86, 0.47, 0.1, 0.03)),
        OcrToken("845", Box(0.86, 0.57, 0.1, 0.03)),
        OcrToken("1.024", Box(0.86, 0.67, 0.1, 0.03)),
        OcrToken(f"@{v.creator}", Box(0.04, 0.75, 0.4, 0.03)),
        OcrToken(v.caption, Box(0.04, 0.86, 0.7, 0.04)),
        OcrToken(own, Box(0.80, 0.95, 0.15, 0.02)),
    ]
    if v.ad:
        toks.append(OcrToken("Gesponsert", Box(0.04, 0.82, 0.2, 0.02)))
    return toks


def _offfeed_tokens(kind: str) -> list[OcrToken]:
    if kind == "inbox":
        return [OcrToken("Posteingang", Box(0.3, 0.07, 0.4, 0.04)), OcrToken("Lisa: kommst du morgen?", Box(0.1, 0.3, 0.8, 0.04))]
    keys = [OcrToken(c, Box(0.05 + i * 0.09, 0.8, 0.05, 0.03)) for i, c in enumerate("QWERTZUIOPASDFG")]
    return [OcrToken("Geheime Antwort an Tim", Box(0.1, 0.5, 0.8, 0.04)), *keys]


class FakeOcr:
    def __init__(self, tokens: dict[int, list[OcrToken]]):
        self.tokens = tokens

    def read(self, image: np.ndarray) -> list[OcrToken]:
        return list(self.tokens.get(id(image), []))


class FakeLm:
    """Deterministisches Modell: leitet alles aus der (geschwärzten) Caption ab."""

    def __init__(self, videos: Sequence[Video]):
        self.by_caption = {v.caption: v for v in videos}
        self.seen_evidence: list[SegmentEvidence] = []

    def _video(self, ev: SegmentEvidence) -> Video | None:
        return next((v for c, v in self.by_caption.items() if c in ev.onscreen_text), None)

    def describe(self, keyframe_jpeg: bytes) -> str:
        return "Ein Bild mit bunten Flächen."

    def classify(self, ev: SegmentEvidence, with_spectrum: bool) -> Classification:
        self.seen_evidence.append(ev)
        v = self._video(ev)
        cat = v.category if v else "other"
        spectrum = v.spectrum if (v and with_spectrum and cat == "politics") else None
        return Classification(cat, 0.9, spectrum, 0.9 if spectrum else None, bool(v and v.dog), f"Video über {cat}.")

    def questions(self, ev: SegmentEvidence) -> list[DraftQuestion]:
        v = self._video(ev)
        if not v:
            return []
        return [
            DraftQuestion("gist", "Worum ging es?", [v.caption, "Kochen", "Fußball", "Mathe"], 0, "onscreen_text", v.caption),
            # ungültig: Beleg steht nicht im Material → muss verworfen werden
            DraftQuestion("detail", "Welche Zahl?", ["1", "2", "3", "4"], 1, "transcript", "nicht vorhanden"),
        ]

    def answer_from_evidence(self, quote: str, question: str, options: Sequence[str]) -> int | None:
        return next((i for i, o in enumerate(options) if o == quote), None)
