import shutil
import subprocess
import wave

import numpy as np
import pytest

from guide_worker.frames import dhash, extract_audio, hamming, probe_duration, read_frames

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None, reason="ffmpeg fehlt")


def make_video(path: str, seconds: int = 4, fps: int = 10, with_audio: bool = True) -> list[np.ndarray]:
    """Hochkant-Video 360×640: jede Sekunde ein anderes Farbmuster (wie ein neues Kurzvideo)."""
    rng = np.random.default_rng(0)
    patterns = [np.kron(rng.integers(0, 255, (16, 9, 3), dtype=np.uint8), np.ones((40, 40, 1), dtype=np.uint8)) for _ in range(seconds)]
    args = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "360x640", "-r", str(fps), "-i", "pipe:0"]
    if with_audio:
        args += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}"]
    args += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-shortest", path]
    proc = subprocess.Popen(args, stdin=subprocess.PIPE)
    for s in range(seconds):
        for _ in range(fps):
            proc.stdin.write(patterns[s].tobytes())
    proc.stdin.close()
    assert proc.wait() == 0
    return patterns


def test_read_frames_samples_and_scales(tmp_path):
    path = str(tmp_path / "rec.mp4")
    patterns = make_video(path)
    assert probe_duration(path) == pytest.approx(4, abs=0.2)
    frames = list(read_frames(path, fps=2, width=180))
    assert len(frames) == 8
    assert frames[0].image.shape == (320, 180, 3)
    assert [f.t for f in frames[:3]] == [0.0, 0.5, 1.0]
    # dasselbe Muster bleibt nach Kodierung erkennbar, verschiedene Muster unterscheiden sich deutlich
    small = [p[::2, ::2] for p in patterns]
    assert hamming(dhash(frames[0].image), dhash(small[0])) <= 8
    assert hamming(dhash(frames[0].image), dhash(frames[2].image)) > 12


def test_read_frames_respects_max_seconds(tmp_path):
    path = str(tmp_path / "rec.mp4")
    make_video(path)
    assert len(list(read_frames(path, fps=2, width=180, max_seconds=2))) == 4


def test_extract_audio(tmp_path):
    path = str(tmp_path / "rec.mp4")
    make_video(path)
    wav = str(tmp_path / "a.wav")
    assert extract_audio(path, wav)
    with wave.open(wav) as w:
        assert w.getframerate() == 16000
        assert w.getnchannels() == 1


def test_extract_audio_without_sound(tmp_path):
    path = str(tmp_path / "mute.mp4")
    make_video(path, with_audio=False)
    assert extract_audio(path, str(tmp_path / "a.wav")) is False
