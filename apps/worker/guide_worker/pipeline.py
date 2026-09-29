"""Pipeline: Aufnahme → Feed-Bericht (AnalysisResult, identisch zu apps/web/src/engine/types.ts).

Reihenfolge (docs/ARCHITEKTUR.md, v3.1 „Redaction first“):
  1. OCR je Frame (nur RAM) → Screen-Erkennung → Nicht-Feed-Frames verwerfen (nur ihre Dauer zählt)
  2. Eigener Account: wiederkehrende Texte an fester Position ermitteln
  3. Feed-Frames schwärzen (Statusleiste, Handles, Creator-Zone, eigener Account)
  4. Segmentierung + Signale
  5. Je Video: Evidenz aus geschwärztem Text + geschwärztem Standbild → Klassifikation → Fragen → Prüfung
  6. Alles, was ins Ergebnis geht, läuft nochmals durch redact_text
"""

from __future__ import annotations

import base64
import io
import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, Sequence

import numpy as np
from PIL import Image

from . import PIPELINE_VERSION
from .engines import AsrEngine, Classification, LanguageModel, OcrEngine, SegmentEvidence, TranscriptPiece
from .frames import Frame
from .redaction import (
    LAYOUTS,
    OcrToken,
    PersistentHandleTracker,
    Screen,
    boxes_to_mask,
    mask_boxes,
    redact_text,
    should_process,
)
from .screens import classify_screen
from .segmentation import FeedFrame, RawSegment, content_hash, count_loops, creator_key, detect_like, is_ad, segment_frames

#: Kategorien, zu denen keine Inhaltsfragen gestellt werden (Arbeitspapier Kap. 12.4 / Beutelsbacher Konsens)
NO_QUESTIONS = {"sexualized", "politics", "advertising", "manosphere"}
#: Oberflächen-Texte, die nicht zum Video gehören
UI_TEXT_RE = re.compile(
    r"^(für dich|for you|folge ich|following|folgen|follow|freunde|friends|live|entdecken|explore|reels|shorts|"
    r"teilen|share|speichern|save|remix|original(ton| sound)?|\d{1,3}([.,]\d{1,3})?\s?(k|m|mio\.?|tsd\.?)?)$",
    re.I,
)


@dataclass(frozen=True)
class PipelineInput:
    frames: Iterable[Frame]
    fps: float
    duration_min: int
    app: str
    politics_spectrum_enabled: bool
    recording_ended_at: str
    transcript: Sequence[TranscriptPiece] = ()
    has_audio: bool = True
    #: Nur für Tests/Kalibrierung: Like-Erkennung trotz unkalibrierter Layout-Zonen
    trust_uncalibrated_layout: bool = False
    model_version: str = "unknown"


def _jpeg_data_url(image: np.ndarray, width: int = 240, quality: int = 70) -> str:
    img = Image.fromarray(image)
    h = int(round(img.height * width / img.width))
    img = img.resize((width, h))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", s)).strip().lower()


def _third(start: float, total: float) -> int:
    if total <= 0:
        return 1
    return min(3, int(start / (total / 3)) + 1)


def _onscreen_text(seg: RawSegment, persistent: set[str]) -> str:
    seen: dict[str, None] = {}
    for f in seg.frames:
        for t in f.tokens:
            txt = t.text.strip()
            if len(txt) < 2 or UI_TEXT_RE.match(txt):
                continue
            seen.setdefault(redact_text(txt, persistent=persistent), None)
    return " · ".join(seen)[:1500]


def _transcript_for(seg_start: float, seg_end: float, pieces: Sequence[TranscriptPiece], persistent: set[str]) -> str:
    parts = [p.text for p in pieces if p.end > seg_start and p.start < seg_end]
    return redact_text(" ".join(parts), persistent=persistent)[:3000]


def run_pipeline(inp: PipelineInput, ocr: OcrEngine, lm: LanguageModel) -> dict:
    layout = LAYOUTS.get(inp.app, LAYOUTS["other"])
    step = 1.0 / inp.fps
    max_t = inp.duration_min * 60.0
    warnings: list[str] = []

    # 1. OCR + Screen-Erkennung; Nicht-Feed sofort verwerfen
    feed_raw: list[tuple[Frame, list[OcrToken]]] = []
    off_feed_frames = 0
    analyzed = 0
    tracker = PersistentHandleTracker()
    for frame in inp.frames:
        if frame.t >= max_t:
            break
        analyzed += 1
        tokens = ocr.read(frame.image)
        screen = classify_screen(tokens)
        if not should_process(screen):
            off_feed_frames += 1
            continue  # Frame und Tokens werden nicht weiter verwendet
        tracker.observe(tokens)
        feed_raw.append((frame, tokens))

    # 2./3. Eigenen Account ermitteln und schwärzen
    persistent = tracker.persistent_texts()
    feed: list[FeedFrame] = []
    for frame, tokens in feed_raw:
        extra = [t.box for t in tokens if t.text.strip().lower() in persistent]
        masked = mask_boxes(frame.image, [*boxes_to_mask(tokens, layout), *extra])
        feed.append(FeedFrame(frame.t, masked, tokens, creator_key(tokens, layout), content_hash(masked)))
    del feed_raw

    if not inp.has_audio:
        warnings.append("Die Aufnahme hat keinen Ton – Fragen beruhen nur auf Bild und Text.")
    if not layout.calibrated:
        warnings.append("Layout der App noch nicht kalibriert – Likes werden nicht ausgewertet.")

    # 4. Segmentierung
    raw_segments = segment_frames(feed, step)
    total = analyzed * step
    segments: list[dict] = []
    for i, seg in enumerate(raw_segments):
        start, end = seg.start, seg.end(step)
        watched = end - start
        skipped = watched < 2.0
        loops = count_loops(seg, step)
        kind = "ad" if is_ad(seg) else "video"
        key = seg.frames[min(len(seg.frames) - 1, int(len(seg.frames) * 0.4))]

        # 5. Evidenz → Klassifikation → Fragen
        keyframe = _jpeg_data_url(key.image)
        visual = ""
        if not skipped:
            visual = redact_text(lm.describe(base64.b64decode(keyframe.split(",", 1)[1])), persistent=persistent)
        ev = SegmentEvidence(
            onscreen_text=_onscreen_text(seg, persistent),
            transcript=_transcript_for(start, end, inp.transcript, persistent),
            visual_description=visual,
        )
        cls: Classification = lm.classify(ev, with_spectrum=inp.politics_spectrum_enabled)
        category = "advertising" if kind == "ad" else cls.category
        questions = [] if skipped or category in NO_QUESTIONS else _build_questions(lm, ev, i, persistent)

        seg_out: dict = {
            "index": i,
            "startSec": round(start, 2),
            "endSec": round(end, 2),
            "watchedSec": round(watched, 2),
            "third": _third(start, total),
            "kind": kind,
            "skipped": skipped,
            "liked": detect_like(seg, inp.app, layout.calibrated or inp.trust_uncalibrated_layout),
            "replays": loops,
            "completed": None if loops is None else (True if loops > 0 else (False if skipped else None)),
            "category": category,
            "categoryConfidence": round(cls.category_confidence, 3),
            "hasDog": cls.has_dog,
            "keyframe": keyframe,
            "summary": redact_text(cls.summary, persistent=persistent),
            "questions": questions,
        }
        if inp.politics_spectrum_enabled and category == "politics" and cls.spectrum:
            seg_out["spectrum"] = cls.spectrum
            seg_out["spectrumConfidence"] = round(cls.spectrum_confidence or 0.0, 3)
        segments.append(seg_out)

    return {
        "meta": {
            "durationMin": inp.duration_min,
            "app": inp.app if inp.app in LAYOUTS else "other",
            "analyzedSec": round(total, 1),
            "offFeedSec": round(off_feed_frames * step, 1),
            "pipelineVersion": PIPELINE_VERSION,
            "modelVersion": inp.model_version,
            "politicsSpectrumEnabled": inp.politics_spectrum_enabled,
            "recordingEndedAt": inp.recording_ended_at,
            "warnings": warnings,
        },
        "segments": segments,
    }


def _build_questions(lm: LanguageModel, ev: SegmentEvidence, seg_index: int, persistent: set[str]) -> list[dict]:
    sources = {"transcript": ev.transcript, "onscreen_text": ev.onscreen_text, "visual": ev.visual_description}
    out: list[dict] = []
    for qi, d in enumerate(lm.questions(ev)[:2]):
        if len(d.options) != 4 or not 0 <= d.correct_index <= 3 or len(set(map(_norm, d.options))) != 4:
            continue
        # Beleg muss wörtlich im (geschwärzten) Material stehen
        if not d.evidence_quote.strip() or _norm(d.evidence_quote) not in _norm(sources.get(d.evidence_source, "")):
            continue
        # Frage und Optionen dürfen nichts Personenbezogenes enthalten
        texts = [d.question, *d.options]
        if any(redact_text(x, persistent=persistent) != x for x in texts):
            continue
        # Zweiter Durchlauf: Lässt sich die Frage allein aus dem Beleg beantworten?
        verified = lm.answer_from_evidence(d.evidence_quote, d.question, d.options) == d.correct_index
        out.append({
            "id": f"s{seg_index}q{qi}",
            "type": d.type if d.type in ("gist", "detail") else "detail",
            "question": d.question,
            "options": list(d.options),
            "correctIndex": d.correct_index,
            "evidence": {"source": d.evidence_source, "quote": d.evidence_quote},
            "verified": verified,
        })
    return out
