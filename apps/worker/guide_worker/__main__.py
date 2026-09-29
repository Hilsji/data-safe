"""Start: python -m guide_worker  (Konfiguration über Umgebungsvariablen, siehe .env.example)."""

import logging
import os

from .engines import FasterWhisper, OllamaModel, PaddleOcr
from .mongo_repo import MongoRepo
from .runner import Engines, loop


def main() -> None:
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
    repo = MongoRepo(os.environ["MONGODB_URI"], os.environ.get("MONGODB_DB", "guide_me"))
    text_model = os.environ.get("OLLAMA_TEXT_MODEL", "qwen2.5:7b-instruct")
    vision_model = os.environ.get("OLLAMA_VISION_MODEL", "qwen2.5vl:7b")
    engines = Engines(
        ocr=PaddleOcr(),
        lm=OllamaModel(os.environ.get("OLLAMA_URL", "http://ollama:11434"), text_model, vision_model),
        asr=None if os.environ.get("ASR_DISABLED") == "1" else FasterWhisper(os.environ.get("WHISPER_MODEL", "small")),
        model_version=f"{text_model}+{vision_model}",
    )
    logging.getLogger("guide_worker").info("Worker gestartet")
    loop(repo, engines, fps=float(os.environ.get("FRAMES_PER_SECOND", "2")), scratch_dir=os.environ.get("SCRATCH_DIR"))


if __name__ == "__main__":
    main()
