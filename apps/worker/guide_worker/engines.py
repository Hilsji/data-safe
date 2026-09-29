"""Austauschbare Erkennungs-Engines: OCR, Spracherkennung, Sprach-/Vision-Modell.

Im Betrieb laufen PaddleOCR, faster-whisper und ein lokales Modell über Ollama – alles in der Schul-Box,
ohne Drittanbieter. Für Tests gibt es einfache Fake-Implementierungen mit derselben Schnittstelle.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol, Sequence

import numpy as np

from .redaction import Box, OcrToken


class OcrEngine(Protocol):
    def read(self, image: np.ndarray) -> list[OcrToken]: ...


class AsrEngine(Protocol):
    def transcribe(self, wav_path: str) -> list["TranscriptPiece"]: ...


@dataclass(frozen=True)
class TranscriptPiece:
    start: float
    end: float
    text: str


@dataclass(frozen=True)
class SegmentEvidence:
    """Alles, was das Modell über ein Video erfährt – bereits geschwärzt."""

    onscreen_text: str
    transcript: str
    visual_description: str


@dataclass(frozen=True)
class Classification:
    category: str
    category_confidence: float
    spectrum: str | None
    spectrum_confidence: float | None
    has_dog: bool
    summary: str


@dataclass(frozen=True)
class DraftQuestion:
    type: str  # "gist" | "detail"
    question: str
    options: list[str]
    correct_index: int
    evidence_source: str  # "transcript" | "onscreen_text" | "visual"
    evidence_quote: str


class LanguageModel(Protocol):
    def describe(self, keyframe_jpeg: bytes) -> str: ...
    def classify(self, ev: SegmentEvidence, with_spectrum: bool) -> Classification: ...
    def questions(self, ev: SegmentEvidence) -> list[DraftQuestion]: ...
    def answer_from_evidence(self, quote: str, question: str, options: Sequence[str]) -> int | None: ...


# ---------------------------------------------------------------------------
# Produktiv-Implementierungen (werden nur im Docker-Image importiert)
# ---------------------------------------------------------------------------


class PaddleOcr:
    def __init__(self, lang: str = "german"):
        from paddleocr import PaddleOCR  # type: ignore[import-not-found]

        self._ocr = PaddleOCR(use_angle_cls=False, lang=lang, show_log=False)

    def read(self, image: np.ndarray) -> list[OcrToken]:
        h, w = image.shape[:2]
        result = self._ocr.ocr(image, cls=False) or []
        tokens: list[OcrToken] = []
        for line in result[0] or []:
            pts, (text, conf) = line
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            tokens.append(OcrToken(text, Box(min(xs) / w, min(ys) / h, (max(xs) - min(xs)) / w, (max(ys) - min(ys)) / h), float(conf)))
        return tokens


class FasterWhisper:
    def __init__(self, model: str = "small", device: str = "auto"):
        from faster_whisper import WhisperModel  # type: ignore[import-not-found]

        self._model = WhisperModel(model, device=device, compute_type="int8")

    def transcribe(self, wav_path: str) -> list[TranscriptPiece]:
        segments, _info = self._model.transcribe(wav_path, vad_filter=True)
        return [TranscriptPiece(s.start, s.end, s.text.strip()) for s in segments]


CATEGORIES = [
    "sport", "gaming", "comedy", "beauty_lifestyle", "luxury_hustle", "fitness", "news", "politics", "manosphere",
    "knowledge", "music_dance", "animals", "food", "relationships", "sexualized", "advertising", "other",
]
SPECTRA = ["left", "center_left", "center", "center_right", "right", "unassignable"]

_CLASSIFY_PROMPT = """Du ordnest ein Kurzvideo einer Themenkategorie zu. Grundlage sind NUR die folgenden Angaben
(Nutzernamen und persönliche Daten wurden bereits entfernt).

Kategorien: {categories}
- "manosphere": Inhalte über Männlichkeit/Status/„Alpha“, die Frauen abwerten oder Beziehungen als Tauschgeschäft darstellen.
- "luxury_hustle": Luxus, schnelles Geld, „Hustle“, Trading-Versprechen.
- "sexualized": anzügliche, sexualisierte Darstellung (keine Details beschreiben).
- "politics": Parteien, Wahlen, politische Forderungen oder Positionen. Reine Nachrichtenmeldungen ohne Position → "news".
{spectrum_rule}
Gib "has_dog": true nur, wenn im Video ein Hund vorkommt.
"summary": ein neutraler deutscher Satz, worum es geht – ohne Namen, ohne Bewertung, ohne Aussehen von Personen.

Einblendungen: {onscreen}
Gesprochenes: {transcript}
Bild: {visual}"""

_SPECTRUM_RULE = """Nur wenn "politics": ordne "spectrum" ein ({spectra}). Bewerte die im Video vertretene Position,
nicht die Person. Im Zweifel "unassignable". Gleiche Maßstäbe für alle Richtungen."""

_QUESTION_PROMPT = """Erstelle bis zu zwei Multiple-Choice-Fragen zu diesem Kurzvideo, um zu prüfen, was hängen geblieben ist:
- eine Frage "gist" zur Kernaussage und eine Frage "detail" zu einem prüfbaren Detail (Zahl, Ort, Produkt, Aussage).
- Jede Frage muss sich allein aus einem wörtlichen Zitat ("evidence_quote") der Angaben beantworten lassen.
- 4 Optionen, genau eine richtig, alle ähnlich lang und plausibel.
- VERBOTEN: Fragen zu Aussehen oder Körper von Personen, zu sexuellen Inhalten, zu politischen Positionen, zu Namen.
- Wenn das Material nicht reicht: leere Liste.

Einblendungen: {onscreen}
Gesprochenes: {transcript}
Bild: {visual}"""

_VERIFY_PROMPT = """Beantworte die Frage NUR mit Hilfe des Zitats. Wenn das Zitat nicht reicht, antworte mit null.
Zitat: {quote}
Frage: {question}
Optionen: {options}"""


class OllamaModel:
    """Lokales Modell über die Ollama-HTTP-API (strukturierte Ausgabe per JSON-Schema)."""

    def __init__(self, base_url: str, text_model: str, vision_model: str, timeout: float = 180):
        import httpx  # type: ignore[import-not-found]

        self._http = httpx.Client(base_url=base_url, timeout=timeout)
        self.text_model = text_model
        self.vision_model = vision_model

    def _chat(self, model: str, prompt: str, schema: dict, images: list[str] | None = None) -> dict:
        msg: dict = {"role": "user", "content": prompt}
        if images:
            msg["images"] = images
        r = self._http.post("/api/chat", json={"model": model, "messages": [msg], "format": schema, "stream": False,
                                               "options": {"temperature": 0}})
        r.raise_for_status()
        return json.loads(r.json()["message"]["content"])

    def describe(self, keyframe_jpeg: bytes) -> str:
        import base64

        schema = {"type": "object", "properties": {"description": {"type": "string"}}, "required": ["description"]}
        prompt = ("Beschreibe sachlich in 1–2 deutschen Sätzen, was auf dem Bild zu sehen ist (Gegenstände, Tätigkeit, Ort, "
                  "eingeblendeter Text). Keine Namen, kein Aussehen von Personen, geschwärzte Bereiche ignorieren.")
        return self._chat(self.vision_model, prompt, schema, [base64.b64encode(keyframe_jpeg).decode()])["description"]

    def classify(self, ev: SegmentEvidence, with_spectrum: bool) -> Classification:
        props: dict = {
            "category": {"type": "string", "enum": CATEGORIES},
            "category_confidence": {"type": "number"},
            "has_dog": {"type": "boolean"},
            "summary": {"type": "string"},
        }
        required = list(props)
        if with_spectrum:
            props["spectrum"] = {"type": "string", "enum": SPECTRA}
            props["spectrum_confidence"] = {"type": "number"}
        schema = {"type": "object", "properties": props, "required": required}
        rule = _SPECTRUM_RULE.format(spectra=", ".join(SPECTRA)) if with_spectrum else "Ordne KEINE politische Richtung ein."
        out = self._chat(self.text_model, _CLASSIFY_PROMPT.format(categories=", ".join(CATEGORIES), spectrum_rule=rule,
                                                                 onscreen=ev.onscreen_text or "–", transcript=ev.transcript or "–",
                                                                 visual=ev.visual_description or "–"), schema)
        spectrum = out.get("spectrum") if with_spectrum and out["category"] == "politics" else None
        return Classification(
            category=out["category"],
            category_confidence=float(np.clip(out["category_confidence"], 0, 1)),
            spectrum=spectrum,
            spectrum_confidence=float(np.clip(out.get("spectrum_confidence", 0), 0, 1)) if spectrum else None,
            has_dog=bool(out["has_dog"]),
            summary=out["summary"],
        )

    def questions(self, ev: SegmentEvidence) -> list[DraftQuestion]:
        q = {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["gist", "detail"]},
                "question": {"type": "string"},
                "options": {"type": "array", "items": {"type": "string"}, "minItems": 4, "maxItems": 4},
                "correct_index": {"type": "integer", "minimum": 0, "maximum": 3},
                "evidence_source": {"type": "string", "enum": ["transcript", "onscreen_text", "visual"]},
                "evidence_quote": {"type": "string"},
            },
            "required": ["type", "question", "options", "correct_index", "evidence_source", "evidence_quote"],
        }
        schema = {"type": "object", "properties": {"questions": {"type": "array", "items": q, "maxItems": 2}}, "required": ["questions"]}
        out = self._chat(self.text_model, _QUESTION_PROMPT.format(onscreen=ev.onscreen_text or "–", transcript=ev.transcript or "–",
                                                                 visual=ev.visual_description or "–"), schema)
        return [DraftQuestion(**x) for x in out["questions"]]

    def answer_from_evidence(self, quote: str, question: str, options: Sequence[str]) -> int | None:
        schema = {"type": "object", "properties": {"answer_index": {"type": ["integer", "null"]}}, "required": ["answer_index"]}
        out = self._chat(self.text_model, _VERIFY_PROMPT.format(quote=quote, question=question,
                                                               options=json.dumps(list(options), ensure_ascii=False)), schema)
        return out["answer_index"]
