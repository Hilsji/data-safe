import { describe, expect, it } from "vitest";
import { cohensKappa, interpretKappa } from "./kappa";

function pairs<T>(spec: [T, T, number][]): [T, T][] {
  return spec.flatMap(([a, b, n]) => Array.from({ length: n }, () => [a, b] as [T, T]));
}

describe("cohensKappa", () => {
  it("Lehrbuchbeispiel: p_o = 0,7, p_e = 0,5 → κ = 0,4", () => {
    const r = cohensKappa(
      pairs([
        ["ja", "ja", 20],
        ["ja", "nein", 5],
        ["nein", "ja", 10],
        ["nein", "nein", 15],
      ]),
    );
    expect(r.observedAgreement).toBeCloseTo(0.7, 12);
    expect(r.expectedAgreement).toBeCloseTo(0.5, 12);
    expect(r.kappa).toBeCloseTo(0.4, 12);
    expect(r.interpretation).toBe("fair");
  });

  it("perfekte Übereinstimmung → κ = 1", () => {
    const r = cohensKappa(pairs([["sport", "sport", 5], ["news", "news", 5], ["politics", "politics", 5]]));
    expect(r.kappa).toBe(1);
  });

  it("gleiche konstante Labels → κ = 1 (statt Division durch 0)", () => {
    expect(cohensKappa(pairs([["a", "a", 4]])).kappa).toBe(1);
  });

  it("systematische Uneinigkeit → negatives κ", () => {
    const r = cohensKappa(pairs([["a", "b", 5], ["b", "a", 5]]));
    expect(r.kappa).toBeLessThan(0);
    expect(r.interpretation).toBe("poor");
  });

  it("wirft bei leerer Eingabe", () => {
    expect(() => cohensKappa([])).toThrow(RangeError);
  });
});

describe("interpretKappa (Landis & Koch 1977)", () => {
  it.each([
    [0.1, "slight"],
    [0.3, "fair"],
    [0.5, "moderate"],
    [0.7, "substantial"],
    [0.9, "almost_perfect"],
  ] as const)("%f → %s", (k, label) => expect(interpretKappa(k)).toBe(label));
});
