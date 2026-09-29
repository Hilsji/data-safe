/**
 * Cohens Kappa für zwei Rater bzw. Rater vs. Modell:
 *   κ = (p_o − p_e) / (1 − p_e)
 * p_o = beobachtete Übereinstimmung, p_e = zufällig erwartete Übereinstimmung aus den Randverteilungen.
 */

export interface KappaResult {
  kappa: number;
  observedAgreement: number;
  expectedAgreement: number;
  n: number;
  interpretation: KappaInterpretation;
}

/** Einordnung nach Landis & Koch (1977). */
export type KappaInterpretation = "poor" | "slight" | "fair" | "moderate" | "substantial" | "almost_perfect";

export function interpretKappa(kappa: number): KappaInterpretation {
  if (kappa < 0) return "poor";
  if (kappa <= 0.2) return "slight";
  if (kappa <= 0.4) return "fair";
  if (kappa <= 0.6) return "moderate";
  if (kappa <= 0.8) return "substantial";
  return "almost_perfect";
}

export function cohensKappa<T>(pairs: readonly (readonly [T, T])[]): KappaResult {
  const n = pairs.length;
  if (n === 0) throw new RangeError("Kappa braucht mindestens ein Paar");
  const countA = new Map<T, number>();
  const countB = new Map<T, number>();
  let agree = 0;
  for (const [a, b] of pairs) {
    if (a === b) agree++;
    countA.set(a, (countA.get(a) ?? 0) + 1);
    countB.set(b, (countB.get(b) ?? 0) + 1);
  }
  const po = agree / n;
  let pe = 0;
  for (const [label, ca] of countA) pe += (ca / n) * ((countB.get(label) ?? 0) / n);
  // Beide Rater vergeben durchgehend dasselbe eine Label: κ ist formal undefiniert; perfekte Übereinstimmung → 1.
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { kappa, observedAgreement: po, expectedAgreement: pe, n, interpretation: interpretKappa(kappa) };
}
