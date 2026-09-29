"""Kalibrier-Werkzeug: Aufnahme des Projektteams (Test-Account!) → JSON für das Admin-Tool.

    python -m guide_worker.calibrate aufnahme.mp4 --app tiktok --title "iPad 9, TikTok, 30.09." --device "iPad 9" > kalibrierung.json

Nie mit Schüleraufnahmen verwenden: Die Ausgabe ist unverschlüsselt und wird von mehreren Ratern angesehen.
Die Politik-Richtung wird hier immer eingeordnet – genau das soll validiert werden.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

from . import PIPELINE_VERSION
from .frames import extract_audio, read_frames
from .pipeline import PipelineInput, run_pipeline


def to_calibration(result: dict, *, title: str, app: str, device: str, model_version: str) -> dict:
    return {
        "title": title,
        "app": app,
        "device": device,
        "modelVersion": model_version,
        "pipelineVersion": PIPELINE_VERSION,
        "segments": [
            {
                "id": f"s{s['index']}",
                "startSec": s["startSec"],
                "endSec": s["endSec"],
                "keyframe": s["keyframe"],
                "model": {
                    "category": s["category"],
                    "categoryConfidence": s["categoryConfidence"],
                    **({"spectrum": s["spectrum"]} if "spectrum" in s else {}),
                    "liked": s["liked"],
                    "replays": s["replays"],
                },
            }
            for s in result["segments"]
        ],
    }


def main(argv: list[str] | None = None) -> None:  # pragma: no cover – benötigt Modelle
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("recording")
    ap.add_argument("--app", default="tiktok")
    ap.add_argument("--title", required=True)
    ap.add_argument("--device", default="")
    ap.add_argument("--minutes", type=int, default=45)
    args = ap.parse_args(argv)

    from .engines import FasterWhisper, OllamaModel, PaddleOcr

    text_model = os.environ.get("OLLAMA_TEXT_MODEL", "qwen2.5:7b-instruct")
    vision_model = os.environ.get("OLLAMA_VISION_MODEL", "qwen2.5vl:7b")
    model_version = f"{text_model}+{vision_model}"
    asr = FasterWhisper(os.environ.get("WHISPER_MODEL", "small"))
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "a.wav")
        transcript = asr.transcribe(wav) if extract_audio(args.recording, wav, max_seconds=args.minutes * 60) else []
    result = run_pipeline(
        PipelineInput(
            frames=read_frames(args.recording, max_seconds=args.minutes * 60),
            fps=2.0,
            duration_min=45 if args.minutes > 30 else (30 if args.minutes > 15 else 15),
            app=args.app,
            politics_spectrum_enabled=True,
            recording_ended_at=datetime.now(timezone.utc).isoformat(),
            transcript=transcript,
            model_version=model_version,
        ),
        PaddleOcr(),
        OllamaModel(os.environ.get("OLLAMA_URL", "http://localhost:11434"), text_model, vision_model),
    )
    json.dump(to_calibration(result, title=args.title, app=args.app, device=args.device, model_version=model_version), sys.stdout, ensure_ascii=False)


if __name__ == "__main__":  # pragma: no cover
    main()
