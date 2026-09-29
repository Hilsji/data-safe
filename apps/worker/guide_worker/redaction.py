"""Schwärzung („Redaction first“) – docs/ARCHITEKTUR.md, Abschnitt v3.1.

Läuft als ERSTE Stufe auf jedem Frame bzw. Text, bevor OCR-Ergebnisse, Transkripte oder Bilder
weiterverarbeitet oder gespeichert werden. Alles passiert im Arbeitsspeicher.

1. Screen-Filter: Nur Feed-Frames werden weiterverarbeitet. DMs, Profile, Einstellungen, Kamera
   und fremde Apps werden verworfen, bevor OCR oder Modell sie sehen.
2. Statusleiste und Benachrichtigungs-Banner werden immer schwarz überdeckt.
3. Nutzernamen (@handles, Anzeigenamen in den Layout-Zonen der App) werden im Bild geschwärzt
   und im Text durch `@nutzer` ersetzt.
4. Weitere personenbezogene Daten im Text (E-Mail, Telefon, IBAN, Adresse, Kfz-Kennzeichen,
   Link-Parameter) werden durch Platzhalter ersetzt.
5. Wiederkehrende Handles an fester Position (typisch: der eigene Account) werden ebenfalls geschwärzt.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from enum import Enum
from typing import Iterable, Sequence

import numpy as np

# ---------------------------------------------------------------------------
# 1. Screen-Filter
# ---------------------------------------------------------------------------


class Screen(str, Enum):
    FEED = "feed"
    COMMENTS = "comments"
    PROFILE = "profile"
    SEARCH = "search"
    INBOX = "inbox"  # Posteingang / Direktnachrichten
    CAMERA = "camera"
    SETTINGS = "settings"
    OTHER_APP = "other_app"  # Home-Bildschirm, andere App, Sperrbildschirm
    KEYBOARD = "keyboard"  # Tastatur sichtbar → es wird gerade getippt
    UNKNOWN = "unknown"


#: Einzige Screen-Art, deren Inhalt analysiert wird.
PROCESSABLE: frozenset[Screen] = frozenset({Screen.FEED})


def should_process(screen: Screen) -> bool:
    """Alles außer dem Feed wird verworfen – nur die Dauer außerhalb des Feeds wird gezählt."""
    return screen in PROCESSABLE


# ---------------------------------------------------------------------------
# 2./3. Bild-Schwärzung
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Box:
    """Rechteck in normierten Koordinaten (0–1), Ursprung oben links."""

    x: float
    y: float
    w: float
    h: float

    def to_pixels(self, width: int, height: int, pad: int = 0) -> tuple[int, int, int, int]:
        x0 = max(0, int(self.x * width) - pad)
        y0 = max(0, int(self.y * height) - pad)
        x1 = min(width, int(round((self.x + self.w) * width)) + pad)
        y1 = min(height, int(round((self.y + self.h) * height)) + pad)
        return x0, y0, x1, y1

    def center(self) -> tuple[float, float]:
        return self.x + self.w / 2, self.y + self.h / 2


@dataclass(frozen=True)
class OcrToken:
    text: str
    box: Box
    confidence: float = 1.0


@dataclass(frozen=True)
class AppLayout:
    """Layout-Zonen einer App. Die Werte sind vorläufig und werden mit Kalibrieraufnahmen justiert."""

    name: str
    status_bar: Box
    #: Zone, in der Creator-Name/Handle steht (unten links über der Caption)
    creator_zones: tuple[Box, ...]
    calibrated: bool = False


LAYOUTS: dict[str, AppLayout] = {
    "tiktok": AppLayout("tiktok", Box(0, 0, 1, 0.06), (Box(0.0, 0.72, 0.8, 0.12),)),
    "instagram_reels": AppLayout("instagram_reels", Box(0, 0, 1, 0.06), (Box(0.0, 0.74, 0.8, 0.1),)),
    "youtube_shorts": AppLayout("youtube_shorts", Box(0, 0, 1, 0.06), (Box(0.0, 0.76, 0.8, 0.1),)),
    "snapchat_spotlight": AppLayout("snapchat_spotlight", Box(0, 0, 1, 0.06), (Box(0.0, 0.78, 0.8, 0.1),)),
    "other": AppLayout("other", Box(0, 0, 1, 0.06), ()),
}


def mask_boxes(frame: np.ndarray, boxes: Iterable[Box], pad_px: int = 4) -> np.ndarray:
    """Überdeckt die Rechtecke schwarz (in-place auf einer Kopie). Kein Weichzeichnen – das wäre umkehrbar."""
    out = frame.copy()
    height, width = out.shape[:2]
    for b in boxes:
        x0, y0, x1, y1 = b.to_pixels(width, height, pad_px)
        out[y0:y1, x0:x1] = 0
    return out


HANDLE_RE = re.compile(r"(?<![\w.])@[A-Za-z0-9_.]{2,30}")


def is_handle(token: str) -> bool:
    return bool(HANDLE_RE.fullmatch(token.strip()))


def _inside(inner: Box, outer: Box) -> bool:
    cx, cy = inner.center()
    return outer.x <= cx <= outer.x + outer.w and outer.y <= cy <= outer.y + outer.h


def boxes_to_mask(tokens: Sequence[OcrToken], layout: AppLayout, *, notification_banners: Sequence[Box] = ()) -> list[Box]:
    """Liefert alle zu schwärzenden Bereiche eines Feed-Frames.

    - immer: Statusleiste und erkannte Benachrichtigungs-Banner
    - jedes Token, das wie ein @handle aussieht oder einen enthält
    - jedes Token in einer Creator-Zone (dort steht der Anzeigename, auch ohne @)
    """
    boxes: list[Box] = [layout.status_bar, *notification_banners]
    for t in tokens:
        if HANDLE_RE.search(t.text) or any(_inside(t.box, z) for z in layout.creator_zones):
            boxes.append(t.box)
    return boxes


@dataclass
class PersistentHandleTracker:
    """Findet Texte, die in vielen Feed-Frames an derselben Stelle stehen (z. B. eigener Account-Name).

    Solche Texte gehören nicht zum Video, sondern zur Oberfläche bzw. zum Nutzer. Sie werden
    zusätzlich geschwärzt – auch wenn sie nicht wie ein @handle aussehen.
    """

    threshold: float = 0.3
    grid: int = 20
    frames: int = 0
    counts: Counter = field(default_factory=Counter)

    def _key(self, t: OcrToken) -> tuple[str, int, int]:
        cx, cy = t.box.center()
        return t.text.strip().lower(), int(cx * self.grid), int(cy * self.grid)

    def observe(self, tokens: Sequence[OcrToken]) -> None:
        self.frames += 1
        for key in {self._key(t) for t in tokens}:
            self.counts[key] += 1

    def is_persistent(self, t: OcrToken, min_frames: int = 10) -> bool:
        if self.frames < min_frames:
            return False
        return self.counts[self._key(t)] / self.frames >= self.threshold

    def persistent_texts(self, min_frames: int = 10) -> set[str]:
        if self.frames < min_frames:
            return set()
        return {text for (text, _, _), n in self.counts.items() if n / self.frames >= self.threshold}


# ---------------------------------------------------------------------------
# 4. Text-Schwärzung
# ---------------------------------------------------------------------------

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
#: Ohne http(s)/www gilt nur eine bekannte Endung als Link – OCR verschluckt oft Leerzeichen („Hallo.Wie“).
_TLDS = "com|de|net|org|ee|io|me|ly|gg|tv|app|co|at|ch|eu|info|link|bio|page|to|fans|xyz|shop|store|site|online|uk|us"
URL_RE = re.compile(
    rf"\b(?:(?:https?://|www\.)((?:[a-z0-9-]+\.)+[a-z]{{2,}})|((?:[a-z0-9-]+\.)+(?:{_TLDS})))\b(/[^\s]*)?",
    re.IGNORECASE,
)
IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b")
PHONE_RE = re.compile(r"(?<![\w+])(?:\+|00)?\d[\d ()/.-]{6,}\d(?!\w)")
STREET_RE = re.compile(
    r"\b[A-ZÄÖÜ][a-zäöüß-]+(?:straße|strasse|str\.|weg|allee|platz|gasse|ring|damm|ufer)\s?\d{1,4}\s?[a-zA-Z]?\b"
)
PLZ_CITY_RE = re.compile(r"\b\d{5}\s[A-ZÄÖÜ][a-zäöüß]+(?:\s[A-ZÄÖÜ][a-zäöüß]+)?\b")
PLATE_RE = re.compile(r"\b[A-ZÄÖÜ]{1,3}[- ][A-Z]{1,2}\s?\d{1,4}[EH]?\b")

#: Domains, die für die Funnel-Aufklärung relevant sind (Arbeitspapier Kap. 8, Link-Aggregatoren).
#: Sie bleiben als Domain erhalten, Pfade und Parameter werden entfernt.
KEEP_DOMAINS_ONLY = True


def _iban_valid(candidate: str) -> bool:
    s = candidate.replace(" ", "")
    if not 15 <= len(s) <= 34:
        return False
    rearranged = s[4:] + s[:4]
    digits = "".join(str(int(c, 36)) for c in rearranged)
    return int(digits) % 97 == 1


@dataclass
class RedactionReport:
    counts: Counter = field(default_factory=Counter)

    def add(self, kind: str) -> None:
        self.counts[kind] += 1


def redact_text(text: str, *, persistent: set[str] | None = None, report: RedactionReport | None = None) -> str:
    """Ersetzt personenbezogene Angaben durch Platzhalter. Reihenfolge ist wichtig (E-Mail vor @handle)."""
    rep = report if report is not None else RedactionReport()

    def sub(pattern: re.Pattern, repl, kind: str, s: str) -> str:
        def _r(m: re.Match) -> str:
            out = repl(m) if callable(repl) else repl
            if out != m.group(0):
                rep.add(kind)
            return out

        return pattern.sub(_r, s)

    s = sub(EMAIL_RE, "[e-mail]", "email", text)
    s = sub(IBAN_RE, lambda m: "[iban]" if _iban_valid(m.group(0)) else m.group(0), "iban", s)
    s = sub(HANDLE_RE, "@nutzer", "handle", s)
    s = sub(URL_RE, lambda m: f"[link:{(m.group(1) or m.group(2)).lower()}]" if KEEP_DOMAINS_ONLY else "[link]", "url", s)
    s = sub(STREET_RE, "[adresse]", "address", s)
    s = sub(PLZ_CITY_RE, "[ort]", "address", s)
    s = sub(PLATE_RE, "[kennzeichen]", "plate", s)
    s = sub(PHONE_RE, lambda m: "[telefon]" if sum(c.isdigit() for c in m.group(0)) >= 7 else m.group(0), "phone", s)
    if persistent:
        for p in sorted(persistent, key=len, reverse=True):
            if p and not p.startswith("["):
                pattern = re.compile(re.escape(p), re.IGNORECASE)
                s = sub(pattern, "[nutzer]", "persistent", s)
    return s
