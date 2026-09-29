import { describe, expect, it } from "vitest";
import { buildPoliticsProfile, DEFAULT_POLITICS_CONFIG, dominantSpectrum } from "./politicsProfile";
import { politicsSegment, result, segment } from "../../tests/unit/fixtures";

const filler = (from: number, n: number) => Array.from({ length: n }, (_, i) => segment(from + i, { category: "comedy" }));

describe("buildPoliticsProfile", () => {
  it("ist ohne Einwilligung/Modellfreigabe deaktiviert", () => {
    const segs = Array.from({ length: 10 }, (_, i) => politicsSegment(i, "left", 30));
    expect(buildPoliticsProfile(result(segs, false))).toEqual({ status: "disabled" });
  });

  it("meldet zu wenig Daten bei geringem Politik-Anteil", () => {
    const segs = [...filler(0, 40), ...Array.from({ length: 6 }, (_, i) => politicsSegment(40 + i, "right", 30))];
    const p = buildPoliticsProfile(result(segs));
    expect(p.status).toBe("insufficient_data");
  });

  it("zählt unsichere und nicht zuordenbare Spektren nicht mit", () => {
    const segs = [
      ...filler(0, 10),
      ...Array.from({ length: 4 }, (_, i) => politicsSegment(10 + i, "left", 30)),
      ...Array.from({ length: 6 }, (_, i) => politicsSegment(14 + i, "right", 30, 0.4)),
      politicsSegment(20, "unassignable", 30),
    ];
    const p = buildPoliticsProfile(result(segs));
    expect(p.status).toBe("insufficient_data");
    if (p.status === "insufficient_data") expect(p.usableCount).toBe(4);
  });

  it("erkennt eine eindeutige Verengung mit hoher Konfidenz", () => {
    const segs = [
      ...filler(0, 20),
      ...Array.from({ length: 8 }, (_, i) => politicsSegment(20 + i, "center_left", 30)),
      ...Array.from({ length: 8 }, (_, i) => politicsSegment(28 + i, "center_right", 2)),
      ...Array.from({ length: 4 }, (_, i) => politicsSegment(36 + i, "center", 2)),
    ];
    const p = buildPoliticsProfile(result(segs));
    expect(p.status).toBe("narrowed");
    if (p.status === "narrowed") {
      expect(p.spectrum).toBe("center_left");
      expect(p.confidence).toBe("high");
      expect(p.ratio).toBeGreaterThanOrEqual(DEFAULT_POLITICS_CONFIG.ratio);
    }
  });

  it("meldet keine Verengung bei ausgewogenem Zuschauen", () => {
    const segs = [
      ...filler(0, 10),
      ...Array.from({ length: 5 }, (_, i) => politicsSegment(10 + i, "left", 20)),
      ...Array.from({ length: 5 }, (_, i) => politicsSegment(15 + i, "right", 20)),
    ];
    expect(buildPoliticsProfile(result(segs)).status).toBe("no_narrowing");
  });

  it("ist symmetrisch: gleiches Muster links und rechts ergibt gleiche Einstufung", () => {
    const build = (a: "left" | "right", b: "left" | "right") => [
      ...filler(0, 20),
      ...Array.from({ length: 7 }, (_, i) => politicsSegment(20 + i, a, 25)),
      ...Array.from({ length: 7 }, (_, i) => politicsSegment(27 + i, b, 5)),
    ];
    const l = buildPoliticsProfile(result(build("left", "right")));
    const r = buildPoliticsProfile(result(build("right", "left")));
    expect(l.status).toBe(r.status);
    if (l.status === "narrowed" && r.status === "narrowed") {
      expect(l.spectrum).toBe("left");
      expect(r.spectrum).toBe("right");
      expect(l.support).toBe(r.support);
    }
  });

  it("ist deterministisch (fester Seed)", () => {
    const segs = [
      ...filler(0, 10),
      ...Array.from({ length: 5 }, (_, i) => politicsSegment(10 + i, "left", 25)),
      ...Array.from({ length: 5 }, (_, i) => politicsSegment(15 + i, "right", 8)),
    ];
    expect(buildPoliticsProfile(result(segs))).toEqual(buildPoliticsProfile(result(segs)));
  });
});

describe("dominantSpectrum", () => {
  it("braucht eine Mindestanzahl je Spektrum", () => {
    const items = [
      { spectrum: "left" as const, engagement: 10 },
      { spectrum: "right" as const, engagement: 1 },
      { spectrum: "right" as const, engagement: 1 },
      { spectrum: "right" as const, engagement: 1 },
    ];
    expect(dominantSpectrum(items, 1.5, 3)).toBeNull();
    expect(dominantSpectrum(items, 1.5, 1)?.spectrum).toBe("left");
  });
});
