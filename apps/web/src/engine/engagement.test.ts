import { describe, expect, it } from "vitest";
import { buildBubbleProfile, DEFAULT_WEIGHTS, segmentEngagement } from "./engagement";
import { segment } from "../../tests/unit/fixtures";
import type { Third } from "./types";

describe("segmentEngagement", () => {
  it("kombiniert Verweildauer, Like, Loops und Skip", () => {
    expect(segmentEngagement(segment(0, { watchedSec: 30, liked: true, replays: 2 }))).toBeCloseTo(1 + 0.5 + 1, 12);
    expect(segmentEngagement(segment(0, { watchedSec: 1, skipped: true, liked: false, replays: 0 }))).toBeCloseTo(1 / 30 - 0.5, 12);
  });
  it("begrenzt Verweildauer und Loops", () => {
    const s = segment(0, { watchedSec: 300, liked: false, replays: 50 });
    expect(segmentEngagement(s)).toBeCloseTo(DEFAULT_WEIGHTS.dwell + DEFAULT_WEIGHTS.replay * DEFAULT_WEIGHTS.maxReplays, 12);
  });
  it("wertet unsichere Signale (null) weder positiv noch negativ", () => {
    const sure = segment(0, { watchedSec: 15, liked: false, replays: 0 });
    const unsure = segment(0, { watchedSec: 15, liked: null, replays: null });
    expect(segmentEngagement(unsure)).toBe(segmentEngagement(sure));
  });
});

describe("buildBubbleProfile", () => {
  it("normiert auf das Angebot: häufig ≠ stark", () => {
    // 8× Sport kurz angesehen, 3× Wissen lange angesehen
    const segs = [
      ...Array.from({ length: 8 }, (_, i) => segment(i, { category: "sport", watchedSec: 4 })),
      ...Array.from({ length: 3 }, (_, i) => segment(8 + i, { category: "knowledge", watchedSec: 30, liked: true })),
    ];
    const p = buildBubbleProfile(segs);
    expect(p.topServed).toBe("sport");
    expect(p.topEngaged).toBe("knowledge");
    const knowledge = p.categories.find((c) => c.category === "knowledge")!;
    expect(knowledge.servedShare).toBeCloseTo(3 / 11, 12);
    expect(knowledge.engagementIndex).toBeGreaterThan(1);
  });

  it("verlangt eine Mindestanzahl für die Top-Engagement-Kategorie", () => {
    const segs = [
      ...Array.from({ length: 5 }, (_, i) => segment(i, { category: "sport", watchedSec: 10 })),
      segment(5, { category: "gaming", watchedSec: 30, liked: true, replays: 3 }),
    ];
    expect(buildBubbleProfile(segs).topEngaged).toBe("sport");
  });

  it("misst die Verengung über die Drittel", () => {
    const cats = ["sport", "gaming", "comedy", "food", "music_dance", "animals"] as const;
    const segs = [
      ...cats.map((c, i) => segment(i, { category: c, third: 1 })),
      ...Array.from({ length: 6 }, (_, i) => segment(6 + i, { category: "manosphere", third: 3 as Third })),
    ];
    const p = buildBubbleProfile(segs, { windowSize: 4 });
    expect(p.entropyFirstThird).toBeCloseTo(1, 12);
    expect(p.entropyLastThird).toBe(0);
    expect(p.entropyCurve.at(-1)!.entropy).toBe(0);
  });

  it("kommt mit leerer Session zurecht", () => {
    const p = buildBubbleProfile([]);
    expect(p.total).toBe(0);
    expect(p.topServed).toBeNull();
    expect(p.categories).toEqual([]);
  });
});
