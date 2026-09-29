import numpy as np
import pytest

from guide_worker.redaction import (
    LAYOUTS,
    Box,
    OcrToken,
    PersistentHandleTracker,
    RedactionReport,
    Screen,
    boxes_to_mask,
    mask_boxes,
    redact_text,
    should_process,
)


class TestScreenFilter:
    def test_only_feed_is_processed(self):
        assert should_process(Screen.FEED)
        for s in Screen:
            if s is not Screen.FEED:
                assert not should_process(s), s


class TestTextRedaction:
    @pytest.mark.parametrize(
        "raw, forbidden, placeholder",
        [
            ("folgt @lena.xyz_07 für mehr", "lena.xyz_07", "@nutzer"),
            ("Schreib mir: max.mustermann@example.de", "mustermann", "[e-mail]"),
            ("Ruf an unter +49 170 1234567!", "1234567", "[telefon]"),
            ("Tel. 0170/1234567", "1234567", "[telefon]"),
            ("Überweisung an DE89 3704 0044 0532 0130 00", "0532", "[iban]"),
            ("Wir wohnen in der Musterstraße 12a", "Musterstraße", "[adresse]"),
            ("10115 Berlin Mitte", "10115", "[ort]"),
            ("Kennzeichen B-AB 1234 gesehen", "AB 1234", "[kennzeichen]"),
        ],
    )
    def test_removes_personal_data(self, raw, forbidden, placeholder):
        out = redact_text(raw)
        assert forbidden not in out
        assert placeholder in out

    def test_keeps_only_domain_of_links(self):
        out = redact_text("Link: https://linktr.ee/geheimname?ref=abc123")
        assert out == "Link: [link:linktr.ee]"

    @pytest.mark.parametrize("text", ["Hallo.Wie geht's", "z.B. heute", "Ende.Neuer Satz"])
    def test_missing_space_after_dot_is_not_a_link(self, text):
        assert redact_text(text) == text

    def test_bare_domain_with_known_tld_is_link(self):
        assert redact_text("mehr auf onlyfans.com/xyz") == "mehr auf [link:onlyfans.com]"

    def test_does_not_touch_normal_numbers(self):
        text = "In 23 Minuten 3 Tipps für 2026 – 100 % sicher"
        assert redact_text(text) == text

    def test_invalid_iban_not_flagged_as_iban(self):
        report = RedactionReport()
        redact_text("DE00 1234 5678 9012 3456 78", report=report)
        assert report.counts["iban"] == 0

    def test_email_is_not_split_into_handle(self):
        out = redact_text("kontakt@firma.de")
        assert out == "[e-mail]"

    def test_persistent_texts_are_redacted(self):
        out = redact_text("Mein Name ist JonasDerCoole und so", persistent={"jonasdercoole"})
        assert "Jonas" not in out
        assert "[nutzer]" in out

    def test_report_counts(self):
        report = RedactionReport()
        redact_text("@a_b und @c_d, Mail x@y.de", report=report)
        assert report.counts["handle"] == 2
        assert report.counts["email"] == 1


class TestFrameMasking:
    def test_status_bar_always_masked(self):
        frame = np.full((100, 50, 3), 255, dtype=np.uint8)
        boxes = boxes_to_mask([], LAYOUTS["tiktok"])
        out = mask_boxes(frame, boxes, pad_px=0)
        assert out[:6].max() == 0  # obere 6 % schwarz
        assert out[50].min() == 255  # Mitte unverändert
        assert frame.min() == 255  # Original unverändert

    def test_handles_and_creator_zone_masked(self):
        layout = LAYOUTS["tiktok"]
        tokens = [
            OcrToken("@creator_name", Box(0.05, 0.4, 0.3, 0.03)),  # Erwähnung irgendwo
            OcrToken("Lisa Beispiel", Box(0.05, 0.75, 0.3, 0.03)),  # Anzeigename in Creator-Zone
            OcrToken("Rezept des Tages", Box(0.2, 0.2, 0.5, 0.05)),  # normaler Inhalt
        ]
        boxes = boxes_to_mask(tokens, layout, notification_banners=[Box(0, 0.06, 1, 0.1)])
        assert tokens[0].box in boxes
        assert tokens[1].box in boxes
        assert tokens[2].box not in boxes
        assert Box(0, 0.06, 1, 0.1) in boxes

    def test_mask_is_solid_black_not_blur(self):
        frame = np.random.default_rng(0).integers(1, 255, (200, 100, 3), dtype=np.uint8)
        out = mask_boxes(frame, [Box(0.1, 0.1, 0.5, 0.5)], pad_px=0)
        assert out[20:120, 10:60].max() == 0


class TestPersistentHandles:
    def test_detects_own_account_at_fixed_position(self):
        tracker = PersistentHandleTracker()
        own = OcrToken("jonas_privat", Box(0.8, 0.9, 0.15, 0.03))
        for i in range(20):
            tracker.observe([own, OcrToken(f"Video {i}", Box(0.1, 0.5, 0.5, 0.05))])
        assert tracker.is_persistent(own)
        assert "jonas_privat" in tracker.persistent_texts()
        assert not tracker.is_persistent(OcrToken("Video 3", Box(0.1, 0.5, 0.5, 0.05)))

    def test_needs_enough_frames(self):
        tracker = PersistentHandleTracker()
        own = OcrToken("x", Box(0.8, 0.9, 0.1, 0.03))
        tracker.observe([own])
        assert not tracker.is_persistent(own)
