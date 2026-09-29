import { describe, expect, it } from "vitest";
import { buildValidationReport, E6, RATED_SPECTRA, type ValidationSegment } from "./validation";
import type { Category, Spectrum } from "./types";

let id = 0;
function seg(model: { category: Category; spectrum?: Spectrum }, r1: { category: Category; spectrum?: Spectrum }, r2 = r1, ok = true): ValidationSegment {
  const tag = (raterId: string, t: { category: Category; spectrum?: Spectrum }) => ({ raterId, ...t, boundaryOk: ok, likeOk: ok, replayOk: ok });
  return { id: `s${id++}`, model, tags: [tag("r1", r1), tag("r2", r2)] };
}

function perfectPolitics(perSpectrum = 12): ValidationSegment[] {
  return RATED_SPECTRA.flatMap((sp) =>
    Array.from({ length: perSpectrum }, () => seg({ category: "politics", spectrum: sp }, { category: "politics", spectrum: sp })),
  );
}

const nonPolitics = (): ValidationSegment[] =>
  (["sport", "gaming", "food", "comedy"] as Category[]).flatMap((c) => Array.from({ length: 5 }, () => seg({ category: c }, { category: c })));

describe("buildValidationReport", () => {
  it("gibt frei, wenn alle E6-Schwellen erfüllt sind", () => {
    const r = buildValidationReport([...perfectPolitics(), ...nonPolitics()]);
    expect(r.spectrum.humanHuman.kappa).toBe(1);
    expect(r.spectrum.humanModel.kappa).toBe(1);
    expect(r.category.humanModel.kappa).toBe(1);
    expect(r.politicsApprovable).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.signalAccuracy.boundary).toBe(1);
  });

  it("verweigert bei zu wenig Daten je Spektrum", () => {
    const r = buildValidationReport(perfectPolitics(E6.minConsensusPerSpectrum - 1));
    expect(r.politicsApprovable).toBe(false);
    expect(r.reasons.some((x) => x.includes("Konsens-Segmente"))).toBe(true);
  });

  it("erkennt Schieflage: Modell erkennt rechts schlechter als links", () => {
    const segs = perfectPolitics(20);
    // bei 6 von 20 „rechts“-Segmenten liegt das Modell daneben → Recall 0,7 (links 1,0 → Lücke 0,3)
    segs.filter((s) => s.tags[0]!.spectrum === "right").slice(0, 6).forEach((s) => (s.model.spectrum = "center_right"));
    const r = buildValidationReport(segs);
    expect(r.recallPerSpectrum.right!.recall).toBeCloseTo(0.7, 10);
    expect(r.mirrorGaps[0]!.gap).toBeCloseTo(0.3, 10);
    expect(r.politicsApprovable).toBe(false);
    expect(r.reasons.some((x) => x.startsWith("Schieflage left/right"))).toBe(true);
  });

  it("verweigert, wenn die Menschen sich uneinig sind (κ Mensch–Mensch zu niedrig)", () => {
    const segs = perfectPolitics(12).map((s, i) =>
      i % 2 ? { ...s, tags: [s.tags[0]!, { ...s.tags[1]!, spectrum: "unassignable" as Spectrum }] } : s,
    );
    const r = buildValidationReport(segs);
    expect(r.spectrum.humanHuman.kappa!).toBeLessThan(E6.minKappa);
    expect(r.politicsApprovable).toBe(false);
  });

  it("wertet Segmente mit nur einem Rater nicht für Kappa", () => {
    const single: ValidationSegment = { id: "x", model: { category: "sport" }, tags: [{ raterId: "r1", category: "sport", boundaryOk: false, likeOk: true, replayOk: true }] };
    const r = buildValidationReport([single]);
    expect(r.doubleTagged).toBe(0);
    expect(r.category.humanHuman.kappa).toBeNull();
    expect(r.signalAccuracy.boundary).toBe(0);
  });
});
