import { describe, expect, it } from "vitest";
import { computeSdt, inverseNormalCdf } from "./sdt";

describe("inverseNormalCdf", () => {
  it.each([
    [0.5, 0],
    [0.975, 1.959963985],
    [0.8413447461, 1],
    [0.0227501319, -2],
    [0.001, -3.090232306],
  ])("z(%f) = %f", (p, z) => {
    expect(inverseNormalCdf(p)).toBeCloseTo(z, 6);
  });

  it("wirft außerhalb von (0,1)", () => {
    expect(() => inverseNormalCdf(0)).toThrow(RangeError);
    expect(() => inverseNormalCdf(1)).toThrow(RangeError);
  });
});

describe("computeSdt (Log-Linear-Korrektur nach Hautus 1995)", () => {
  it("Zufallsleistung ergibt d′ = 0", () => {
    const r = computeSdt({ hits: 3, misses: 3, falseAlarms: 3, correctRejections: 3 });
    expect(r.dPrime).toBeCloseTo(0, 10);
    expect(r.criterion).toBeCloseTo(0, 10);
  });

  it("berechnet d′ mit korrigierten Raten", () => {
    // H = 6,5/9, FA = 1,5/9
    const r = computeSdt({ hits: 6, misses: 2, falseAlarms: 1, correctRejections: 7 });
    const expected = inverseNormalCdf(6.5 / 9) - inverseNormalCdf(1.5 / 9);
    expect(r.dPrime).toBeCloseTo(expected, 10);
    expect(r.dPrime).toBeCloseTo(1.5569, 3);
    // Unkorrigierte Raten werden für die Anzeige ausgegeben
    expect(r.hitRate).toBe(0.75);
    expect(r.falseAlarmRate).toBe(0.125);
  });

  it("bleibt bei perfekter Leistung endlich", () => {
    const r = computeSdt({ hits: 6, misses: 0, falseAlarms: 0, correctRejections: 6 });
    expect(Number.isFinite(r.dPrime)).toBe(true);
    expect(r.dPrime).toBeGreaterThan(2);
  });

  it("perfekte Leistung mit mehr Items ergibt höheres d′ (Listenlänge wirkt auf die Korrektur)", () => {
    const small = computeSdt({ hits: 6, misses: 0, falseAlarms: 0, correctRejections: 6 });
    const large = computeSdt({ hits: 12, misses: 0, falseAlarms: 0, correctRejections: 12 });
    expect(large.dPrime).toBeGreaterThan(small.dPrime);
  });

  it("lehnt ungültige Eingaben ab", () => {
    expect(() => computeSdt({ hits: 0, misses: 0, falseAlarms: 1, correctRejections: 1 })).toThrow();
    expect(() => computeSdt({ hits: -1, misses: 1, falseAlarms: 1, correctRejections: 1 })).toThrow();
    expect(() => computeSdt({ hits: 1.5, misses: 1, falseAlarms: 1, correctRejections: 1 })).toThrow();
  });
});
