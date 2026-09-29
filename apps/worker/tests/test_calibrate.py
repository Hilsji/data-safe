from guide_worker.calibrate import to_calibration
from guide_worker.pipeline import PipelineInput, run_pipeline

from .synthetic import FakeLm, FakeOcr, Scenario, Video


def test_calibration_output_matches_admin_schema_and_keeps_spectrum():
    videos = [Video("a_b", "Pasta", 6, category="food"), Video("c_d", "Wahlprogramm", 6, category="politics", spectrum="right")]
    frames, tokens = Scenario(items=videos).build()
    result = run_pipeline(
        PipelineInput(frames=frames, fps=2, duration_min=15, app="tiktok", politics_spectrum_enabled=True, recording_ended_at="x", model_version="m"),
        FakeOcr(tokens), FakeLm(videos),
    )
    cal = to_calibration(result, title="Test", app="tiktok", device="iPad", model_version="m")
    assert set(cal) == {"title", "app", "device", "modelVersion", "pipelineVersion", "segments"}
    seg = cal["segments"][1]
    assert set(seg) == {"id", "startSec", "endSec", "keyframe", "model"}
    assert seg["model"]["spectrum"] == "right"
    assert seg["keyframe"].startswith("data:image/jpeg;base64,")
    assert "questions" not in seg and "summary" not in seg
