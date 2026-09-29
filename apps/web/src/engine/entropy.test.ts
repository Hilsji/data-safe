import { describe, expect, it } from "vitest";
import { entropyCurve, normalizedEntropy, shannonEntropy } from "./entropy";

describe("shannonEntropy", () => {
  it("eine einzige Kategorie hat Entropie 0", () => {
    expect(shannonEntropy([10])).toBe(0);
  });
  it("Gleichverteilung über 4 Kategorien hat 2 Bit", () => {
    expect(shannonEntropy([5, 5, 5, 5])).toBeCloseTo(2, 12);
  });
  it("ignoriert Nullen und leere Eingaben", () => {
    expect(shannonEntropy([0, 4, 4])).toBeCloseTo(1, 12);
    expect(shannonEntropy([])).toBe(0);
  });
  it("bekannter Wert für (1/2, 1/4, 1/4) = 1,5 Bit", () => {
    expect(shannonEntropy([2, 1, 1])).toBeCloseTo(1.5, 12);
  });
});

describe("normalizedEntropy", () => {
  it("ist 1, wenn jedes Element eine andere Kategorie hat", () => {
    expect(normalizedEntropy(["a", "b", "c", "d"], 17)).toBeCloseTo(1, 12);
  });
  it("ist 0 bei reiner Blase", () => {
    expect(normalizedEntropy(["a", "a", "a"], 17)).toBe(0);
  });
  it("liegt immer in [0,1]", () => {
    const v = normalizedEntropy(["a", "a", "b", "c", "c", "c"], 3);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });
});

describe("entropyCurve", () => {
  it("zeigt Verengung: vielfältig am Anfang, eintönig am Ende", () => {
    const labels = ["a", "b", "c", "d", "e", "a", "a", "a", "a", "a"];
    const items = labels.map((label, i) => ({ label, tSec: i * 10 }));
    const curve = entropyCurve(items, 17, 5);
    expect(curve).toHaveLength(6);
    expect(curve[0]!.entropy).toBeCloseTo(1, 12);
    expect(curve.at(-1)!.entropy).toBe(0);
    expect(curve.at(-1)!.tSec).toBe(90);
  });
  it("liefert nichts, wenn weniger Items als Fenster vorhanden sind", () => {
    expect(entropyCurve([{ label: "a", tSec: 0 }], 17, 10)).toEqual([]);
  });
  it("lehnt Fenster < 2 ab", () => {
    expect(() => entropyCurve([], 17, 1)).toThrow(RangeError);
  });
});
