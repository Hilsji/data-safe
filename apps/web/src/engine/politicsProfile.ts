/**
 * Politik-Feed-Profil (Art. 9 DSGVO – wird NUR im Browser berechnet, nie gespeichert, nie übertragen).
 *
 * Beschreibt, wohin sich der FEED verengt hat, nie, was die Person denkt.
 * Voraussetzungen (docs/ARCHITEKTUR.md, Abschnitt 8 + E6):
 *  - Einwilligung + freigegebenes Modell (meta.politicsSpectrumEnabled)
 *  - Politik-Anteil ≥ minShare UND ≥ minCount Politiksegmente mit Spektrum-Konfidenz ≥ minConfidence
 *  - ein Spektrum (≥ minPerSpectrum Segmente) mit mittlerem Engagement ≥ ratio × Politik-Durchschnitt
 *  - Konfidenz per Bootstrap: Anteil der Resamples, in denen dasselbe Spektrum die Bedingung erfüllt
 */
import { segmentEngagement } from "./engagement";
import { createRng } from "./rng";
import type { AnalysisResult, Segment, Spectrum } from "./types";

export interface PoliticsConfig {
  minShare: number;
  minCount: number;
  minConfidence: number;
  ratio: number;
  minPerSpectrum: number;
  bootstrapSamples: number;
  highConfidence: number;
  mediumConfidence: number;
  seed: number;
}

export const DEFAULT_POLITICS_CONFIG: PoliticsConfig = {
  minShare: 0.15,
  minCount: 6,
  minConfidence: 0.7,
  ratio: 1.5,
  minPerSpectrum: 3,
  bootstrapSamples: 1000,
  highConfidence: 0.9,
  mediumConfidence: 0.7,
  seed: 20260929,
};

export type PoliticsFeedProfile =
  | { status: "disabled" }
  | { status: "insufficient_data"; politicsShare: number; usableCount: number }
  | { status: "no_narrowing"; politicsShare: number; usableCount: number }
  | { status: "unclear"; politicsShare: number; usableCount: number; candidate: Spectrum; support: number }
  | {
      status: "narrowed";
      politicsShare: number;
      usableCount: number;
      spectrum: Spectrum;
      ratio: number;
      confidence: "medium" | "high";
      support: number;
    };

/**
 * Dominantes Spektrum: mittleres Engagement im Spektrum ≥ ratio × mittleres Politik-Engagement
 * und mindestens minPerSpectrum Segmente. Bei mehreren gewinnt das höchste Verhältnis.
 */
export function dominantSpectrum(
  items: readonly { spectrum: Spectrum; engagement: number }[],
  ratio: number,
  minPerSpectrum: number,
): { spectrum: Spectrum; ratio: number } | null {
  if (items.length === 0) return null;
  const mean = items.reduce((s, i) => s + i.engagement, 0) / items.length;
  if (mean <= 0) return null;
  const sums = new Map<Spectrum, { sum: number; n: number }>();
  for (const i of items) {
    const e = sums.get(i.spectrum) ?? { sum: 0, n: 0 };
    e.sum += i.engagement;
    e.n++;
    sums.set(i.spectrum, e);
  }
  let best: { spectrum: Spectrum; ratio: number } | null = null;
  for (const [spectrum, { sum, n }] of sums) {
    if (n < minPerSpectrum) continue;
    const r = sum / n / mean;
    if (r >= ratio && (best === null || r > best.ratio)) best = { spectrum, ratio: r };
  }
  return best;
}

export function buildPoliticsProfile(
  result: Pick<AnalysisResult, "meta" | "segments">,
  config: PoliticsConfig = DEFAULT_POLITICS_CONFIG,
): PoliticsFeedProfile {
  if (!result.meta.politicsSpectrumEnabled) return { status: "disabled" };
  const segments = result.segments;
  const politics = segments.filter((s) => s.category === "politics");
  const politicsShare = segments.length > 0 ? politics.length / segments.length : 0;
  const usable = politics.filter(
    (s): s is Segment & { spectrum: Spectrum } =>
      s.spectrum !== undefined &&
      s.spectrum !== "unassignable" &&
      (s.spectrumConfidence ?? 0) >= config.minConfidence,
  );
  const base = { politicsShare, usableCount: usable.length };
  if (politicsShare < config.minShare || usable.length < config.minCount) {
    return { status: "insufficient_data", ...base };
  }
  const items = usable.map((s) => ({ spectrum: s.spectrum, engagement: Math.max(segmentEngagement(s), 0) }));
  const observed = dominantSpectrum(items, config.ratio, config.minPerSpectrum);
  if (!observed) return { status: "no_narrowing", ...base };

  const rng = createRng(config.seed);
  let hits = 0;
  for (let b = 0; b < config.bootstrapSamples; b++) {
    const resample = Array.from({ length: items.length }, () => items[Math.floor(rng() * items.length)]!);
    if (dominantSpectrum(resample, config.ratio, config.minPerSpectrum)?.spectrum === observed.spectrum) hits++;
  }
  const support = hits / config.bootstrapSamples;
  if (support >= config.highConfidence) {
    return { status: "narrowed", ...base, spectrum: observed.spectrum, ratio: observed.ratio, confidence: "high", support };
  }
  if (support >= config.mediumConfidence) {
    return { status: "narrowed", ...base, spectrum: observed.spectrum, ratio: observed.ratio, confidence: "medium", support };
  }
  return { status: "unclear", ...base, candidate: observed.spectrum, support };
}
