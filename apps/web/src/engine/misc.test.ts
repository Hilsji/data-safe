import { describe, expect, it } from "vitest";
import { createBaseline, scoreBaseline, BASELINE_SPEC } from "./baseline";
import { buildContribution, contributionSchema, dPrimeBucket, entropyDropBucket, pctBucket, videosBucket } from "./aggregate";
import { buildBubbleProfile } from "./engagement";
import { futureSelf, hoursPerYear } from "./timeCalculator";
import { createRng } from "./rng";
import { segment } from "../../tests/unit/fixtures";
import type { QuizScore } from "./quizScoring";

describe("baseline", () => {
  it("zieht 8 Lern- und 8 Ablenkerwörter ohne Überschneidung", () => {
    const run = createBaseline(1);
    expect(run.study).toHaveLength(BASELINE_SPEC.study);
    expect(run.test).toHaveLength(16);
    const lures = run.test.filter((t) => !t.isOld).map((t) => t.word);
    expect(lures.some((w) => run.study.includes(w))).toBe(false);
  });
  it("wertet per d′ aus", () => {
    const run = createBaseline(2);
    const perfect = Object.fromEntries(run.test.map((t) => [t.word, t.isOld]));
    expect(scoreBaseline(run, perfect).dPrime).toBeGreaterThan(2);
    expect(scoreBaseline(run, {}).hitRate).toBe(0);
  });
});

describe("rng", () => {
  it("liefert gleichverteilte Werte in [0,1)", () => {
    const rng = createRng(123);
    const values = Array.from({ length: 10000 }, rng);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });
});

describe("aggregate", () => {
  it("klemmt Buckets an den Rändern", () => {
    expect(pctBucket(0)).toBe(0);
    expect(pctBucket(1)).toBe(9);
    expect(dPrimeBucket(-5)).toBe(0);
    expect(dPrimeBucket(10)).toBe(9);
    expect(videosBucket(19)).toBe(0);
    expect(videosBucket(20)).toBe(1);
    expect(videosBucket(999)).toBe(10);
    expect(entropyDropBucket(0)).toBe(5);
  });

  const score: QuizScore = {
    content: { correct: 5, total: 9, share: 5 / 9 },
    contentByThird: { 1: { correct: 2, total: 3, share: 2 / 3 }, 2: { correct: 2, total: 3, share: 2 / 3 }, 3: { correct: 1, total: 3, share: 1 / 3 } },
    contentByType: { gist: { correct: 3, total: 4, share: 0.75 }, detail: { correct: 2, total: 5, share: 0.4 } },
    recognition: { hitRate: 0.8, falseAlarmRate: 0.2, dPrime: 1.6, criterion: 0 },
    orderCorrect: true,
    prospectiveSuccess: false,
    deltaToBaseline: -0.3,
    limited: false,
  };

  it("überträgt nie Politik – auch nicht als Top-Kategorie", () => {
    const segs = [
      ...Array.from({ length: 10 }, (_, i) => segment(i, { category: "politics", spectrum: "left", spectrumConfidence: 0.9 })),
      ...Array.from({ length: 3 }, (_, i) => segment(10 + i, { category: "news" })),
    ];
    const c = buildContribution({ token: "x".repeat(32), durationMin: 30, score, bubble: buildBubbleProfile(segs) });
    expect(c.topCategory).toBe("news");
    expect(JSON.stringify(c)).not.toMatch(/politic|left|right|spectrum/i);
  });

  it("Schema weist Zusatzfelder und Politik ab", () => {
    const base = buildContribution({ token: "x".repeat(32), durationMin: 15, score, bubble: buildBubbleProfile([segment(0)]) });
    expect(contributionSchema.safeParse(base).success).toBe(true);
    expect(contributionSchema.safeParse({ ...base, spectrum: "left" }).success).toBe(false);
    expect(contributionSchema.safeParse({ ...base, topCategory: "politics" }).success).toBe(false);
    expect(contributionSchema.safeParse({ ...base, durationMin: 60 }).success).toBe(false);
  });
});

describe("timeCalculator", () => {
  it("rechnet Minuten pro Tag in Stunden pro Jahr um", () => {
    expect(hoursPerYear(60)).toBe(365);
    expect(hoursPerYear(0)).toBe(0);
    expect(() => hoursPerYear(-1)).toThrow(RangeError);
    expect(() => hoursPerYear(1441)).toThrow(RangeError);
  });
  it("„1 Stunde weniger“ geht nicht unter 0", () => {
    const f = futureSelf(30);
    expect(f.reduced.minutesPerDay).toBe(0);
    expect(f.gainedHoursPerYear).toBeCloseTo(182.5, 12);
  });
  it("zeigt nur Äquivalente mit geprüfter Quelle", () => {
    const f = futureSelf(180);
    expect(f.equivalents.every((e) => e.equivalent.status === "verified")).toBe(true);
    expect(f.equivalents.find((e) => e.equivalent.id === "driving_theory")).toBeUndefined();
  });
});
