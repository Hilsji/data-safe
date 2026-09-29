"""Screen-Erkennung: Ist dieser Frame der Video-Feed – oder DM, Profil, Einstellungen, Tastatur, andere App?

Die Erkennung nutzt nur Schlüsselwörter und Lage der OCR-Tokens. Der Frame wird dabei nicht gespeichert.
Alles, was nicht eindeutig Feed ist, wird verworfen (lieber ein Video zu wenig als eine DM zu viel).
"""

from __future__ import annotations

import re
from typing import Sequence

from .redaction import OcrToken, Screen

_KEYWORDS: list[tuple[Screen, re.Pattern]] = [
    (Screen.INBOX, re.compile(r"posteingang|inbox|nachricht senden|send (a )?message|neue nachricht|new message|\bchats?\b|direktnachricht|\bdms?\b", re.I)),
    (Screen.SETTINGS, re.compile(r"einstellungen|settings|datenschutz|privacy|konto verwalten|manage account|abmelden|log ?out", re.I)),
    (Screen.PROFILE, re.compile(r"profil bearbeiten|edit profile|profil teilen|share profile", re.I)),
    (Screen.COMMENTS, re.compile(r"kommentar hinzufügen|add (a )?comment|\d+\s*(kommentare|comments)\b", re.I)),
    (Screen.SEARCH, re.compile(r"suchverlauf|search history|recent searches|zuletzt gesucht", re.I)),
    (Screen.CAMERA, re.compile(r"\b(effekte|effects|vorlagen|templates)\b.*|aufnehmen|tap to record", re.I)),
]

#: Zähler in der Aktionsleiste rechts (Likes, Kommentare, Teilen), z. B. „12,3K“, „1.024“, „3 Mio.“
_COUNT_RE = re.compile(r"^\d{1,3}([.,]\d{1,3})?\s?(k|m|mio\.?|tsd\.?|b)?$", re.I)


def _is_keyboard(tokens: Sequence[OcrToken]) -> bool:
    lower = [t for t in tokens if t.box.y > 0.55]
    singles = sum(1 for t in lower if len(t.text.strip()) == 1 and t.text.strip().isalpha())
    rows = any(re.search(r"q\s?w\s?e\s?r\s?t\s?[zy]", t.text, re.I) for t in lower)
    return singles >= 12 or rows


def has_action_rail(tokens: Sequence[OcrToken]) -> bool:
    """Feed-Merkmal aller unterstützten Apps: mind. zwei Zähler rechts in der Bildmitte."""
    rail = [t for t in tokens if t.box.x >= 0.78 and 0.3 <= t.box.y <= 0.9 and _COUNT_RE.match(t.text.strip())]
    return len(rail) >= 2


def classify_screen(tokens: Sequence[OcrToken]) -> Screen:
    if _is_keyboard(tokens):
        return Screen.KEYBOARD
    text = " ".join(t.text for t in tokens)
    for screen, pattern in _KEYWORDS:
        if pattern.search(text):
            return screen
    if has_action_rail(tokens):
        return Screen.FEED
    return Screen.OTHER_APP if tokens else Screen.UNKNOWN
