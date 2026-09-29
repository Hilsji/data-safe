import json

from guide_worker.pipeline import PipelineInput, run_pipeline
from guide_worker.redaction import Box, OcrToken, Screen
from guide_worker.screens import classify_screen

from .synthetic import FakeLm, FakeOcr, OffFeed, Scenario, Video


def scenario():
    videos = [
        Video("creator_one", "Drei Tricks für Pasta", 12, category="food", liked=True),
        Video("creator_two", "Skip mich", 1, category="comedy"),
        Video("creator_three", "Wahlprogramm erklärt", 10, category="politics", spectrum="center_left"),
        Video("creator_four", "Mein Hund lernt Pfote", 16, category="animals", dog=True, loop_period=5),
        Video("brand_x", "Neue Sneaker jetzt", 6, category="fashion", ad=True),
        Video("creator_five", "Physik in 30 Sekunden", 9, category="knowledge"),
    ]
    items = [videos[0], videos[1], OffFeed("inbox", 4), videos[2], OffFeed("keyboard", 3), videos[3], videos[4], videos[5]]
    return videos, Scenario(items=items)


def run(politics: bool = True, trust: bool = True):
    videos, sc = scenario()
    frames, tokens = sc.build()
    lm = FakeLm(videos)
    result = run_pipeline(
        PipelineInput(frames=frames, fps=sc.fps, duration_min=15, app="tiktok", politics_spectrum_enabled=politics,
                      recording_ended_at="2026-09-30T08:00:00Z", trust_uncalibrated_layout=trust),
        FakeOcr(tokens), lm,
    )
    return result, lm


def test_segments_match_videos_and_off_feed_is_dropped():
    result, _ = run()
    segs = result["segments"]
    assert len(segs) == 6
    assert result["meta"]["offFeedSec"] == 7.0
    assert [s["skipped"] for s in segs] == [False, True, False, False, False, False]


def test_nothing_private_leaks_into_result():
    result, lm = run()
    dump = json.dumps(result, ensure_ascii=False)
    for secret in ["Lisa", "kommst du", "Geheime Antwort", "jonas_privat", "creator_one", "creator_two", "brand_x", "10:42"]:
        assert secret not in dump, secret
    # auch das Modell hat nie DM-Inhalte oder den eigenen Account gesehen
    seen = json.dumps([e.__dict__ for e in lm.seen_evidence], ensure_ascii=False)
    for secret in ["Lisa", "Geheime Antwort", "jonas_privat", "creator_one"]:
        assert secret not in seen, secret


def test_signals():
    segs = run()[0]["segments"]
    assert segs[0]["liked"] is True
    assert segs[5]["liked"] is False
    assert segs[3]["replays"] >= 2
    assert segs[3]["completed"] is True
    assert segs[3]["hasDog"] is True
    assert segs[4]["kind"] == "ad" and segs[4]["category"] == "advertising"


def test_likes_are_unknown_without_calibration():
    result, _ = run(trust=False)
    assert all(s["liked"] is None for s in result["segments"])
    assert any("kalibriert" in w for w in result["meta"]["warnings"])


def test_politics_spectrum_only_with_consent():
    with_consent = run(politics=True)[0]["segments"][2]
    without = run(politics=False)[0]["segments"][2]
    assert with_consent["spectrum"] == "center_left"
    assert "spectrum" not in without


def test_questions_are_verified_and_filtered():
    segs = run()[0]["segments"]
    food = segs[0]["questions"]
    assert len(food) == 1  # zweite Frage hatte keinen Beleg im Material
    assert food[0]["verified"] is True
    assert food[0]["evidence"]["quote"] in "Drei Tricks für Pasta"
    assert segs[1]["questions"] == []  # übersprungen
    assert segs[2]["questions"] == []  # Politik: keine Inhaltsfragen
    assert segs[4]["questions"] == []  # Werbung


def test_keyframe_has_black_status_bar():
    import base64
    import io

    import numpy as np
    from PIL import Image

    kf = run()[0]["segments"][0]["keyframe"]
    img = np.asarray(Image.open(io.BytesIO(base64.b64decode(kf.split(",", 1)[1]))))
    top = img[: int(img.shape[0] * 0.04)]
    assert top.mean() < 25  # JPEG-Artefakte erlaubt, aber dunkel


def test_thirds_and_meta():
    result, _ = run()
    thirds = [s["third"] for s in result["segments"]]
    assert thirds == sorted(thirds)
    assert result["meta"]["durationMin"] == 15
    assert result["meta"]["app"] == "tiktok"


def test_screen_classifier():
    feed = [OcrToken("12K", Box(0.86, 0.45, 0.1, 0.03)), OcrToken("300", Box(0.86, 0.55, 0.1, 0.03))]
    assert classify_screen(feed) is Screen.FEED
    assert classify_screen([*feed, OcrToken("Profil bearbeiten", Box(0.3, 0.3, 0.3, 0.03))]) is Screen.PROFILE
    assert classify_screen([*feed, OcrToken("Nachricht senden", Box(0.3, 0.9, 0.3, 0.03))]) is Screen.INBOX
    assert classify_screen([OcrToken("Hallo", Box(0.3, 0.3, 0.3, 0.03))]) is Screen.OTHER_APP
    assert classify_screen([]) is Screen.UNKNOWN
