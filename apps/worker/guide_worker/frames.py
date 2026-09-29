"""Frames aus der Aufnahme lesen und einfache Bildmerkmale berechnen (nur numpy, keine schweren Abhängigkeiten).

ffmpeg dekodiert die Aufnahme direkt in den Arbeitsspeicher (Pipe), es werden keine Einzelbilder auf die Platte geschrieben.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from typing import Iterator

import numpy as np


@dataclass(frozen=True)
class Frame:
    t: float  # Sekunden seit Aufnahmebeginn
    image: np.ndarray  # H×W×3, uint8, RGB


def probe_duration(path: str, ffprobe: str = "ffprobe") -> float:
    out = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
        check=True, capture_output=True, text=True,
    ).stdout
    return float(json.loads(out)["format"]["duration"])


def probe_size(path: str, ffprobe: str = "ffprobe") -> tuple[int, int]:
    out = subprocess.run(
        [ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", path],
        check=True, capture_output=True, text=True,
    ).stdout
    s = json.loads(out)["streams"][0]
    return int(s["width"]), int(s["height"])


def read_frames(path: str, *, fps: float = 2.0, width: int = 360, max_seconds: float | None = None,
                ffmpeg: str = "ffmpeg", ffprobe: str = "ffprobe") -> Iterator[Frame]:
    """Liefert Frames mit `fps` Bildern pro Sekunde, skaliert auf `width` (Seitenverhältnis bleibt)."""
    src_w, src_h = probe_size(path, ffprobe)
    height = int(round(src_h * width / src_w / 2)) * 2
    args = [ffmpeg, "-v", "error", "-i", path]
    if max_seconds:
        args += ["-t", str(max_seconds)]
    args += ["-vf", f"fps={fps},scale={width}:{height}", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]
    frame_bytes = width * height * 3
    proc = subprocess.Popen(args, stdout=subprocess.PIPE)
    assert proc.stdout is not None
    i = 0
    try:
        while True:
            buf = proc.stdout.read(frame_bytes)
            if len(buf) < frame_bytes:
                break
            yield Frame(i / fps, np.frombuffer(buf, dtype=np.uint8).reshape(height, width, 3))
            i += 1
    finally:
        proc.stdout.close()
        proc.wait()


def extract_audio(path: str, out_wav: str, *, max_seconds: float | None = None, ffmpeg: str = "ffmpeg") -> bool:
    """Audio als 16-kHz-Mono-WAV (für die Spracherkennung). False, wenn die Aufnahme keinen Ton hat."""
    args = [ffmpeg, "-v", "error", "-y", "-i", path]
    if max_seconds:
        args += ["-t", str(max_seconds)]
    args += ["-vn", "-ac", "1", "-ar", "16000", out_wav]
    r = subprocess.run(args, capture_output=True)
    return r.returncode == 0


# ---------------------------------------------------------------------------
# Bildmerkmale
# ---------------------------------------------------------------------------


def to_gray(img: np.ndarray) -> np.ndarray:
    return (img[..., 0] * 0.299 + img[..., 1] * 0.587 + img[..., 2] * 0.114).astype(np.float32)


def _resize_gray(gray: np.ndarray, w: int, h: int) -> np.ndarray:
    """Block-Mittelwert-Verkleinerung ohne OpenCV."""
    H, W = gray.shape
    ys = np.linspace(0, H, h + 1).astype(int)
    xs = np.linspace(0, W, w + 1).astype(int)
    out = np.empty((h, w), dtype=np.float32)
    for i in range(h):
        for j in range(w):
            block = gray[ys[i]:max(ys[i + 1], ys[i] + 1), xs[j]:max(xs[j + 1], xs[j] + 1)]
            out[i, j] = block.mean()
    return out


def dhash(img: np.ndarray, size: int = 8) -> int:
    """Differenz-Hash (64 Bit): robust gegen Helligkeit/Kompression, gut zum Wiedererkennen desselben Bilds."""
    small = _resize_gray(to_gray(img), size + 1, size)
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def mean_abs_diff(a: np.ndarray, b: np.ndarray) -> float:
    """Mittlere absolute Grauwert-Differenz (0–255)."""
    return float(np.abs(to_gray(a) - to_gray(b)).mean())


def crop(img: np.ndarray, x: float, y: float, w: float, h: float) -> np.ndarray:
    H, W = img.shape[:2]
    return img[int(y * H):int((y + h) * H), int(x * W):int((x + w) * W)]
