/**
 * Baseline (2 min): 8 Begriffe merken, danach 16 Begriffe wiedererkennen (8 alt, 8 neu).
 * Ergebnis ist der persönliche Ausgangswert d′ – verglichen wird nur mit sich selbst.
 * Die Wörter sind neutrale, konkrete Substantive ähnlicher Länge und Häufigkeit (ohne Bezug zu Social Media).
 */
import { computeSdt, type SdtResult } from "./sdt";
import { createRng, shuffle } from "./rng";

export const BASELINE_WORDS_DE = [
  "Anker", "Birne", "Brücke", "Decke", "Eimer", "Feder", "Gabel", "Hammer",
  "Insel", "Kerze", "Leiter", "Mantel", "Nadel", "Orgel", "Pinsel", "Rakete",
  "Sattel", "Tasse", "Ufer", "Vase", "Wolke", "Zange", "Kompass", "Laterne",
  "Muschel", "Palme", "Schraube", "Trommel", "Zelt", "Geige", "Kiste", "Löffel",
] as const;

export const BASELINE_SPEC = { study: 8, lures: 8, studySecondsPerWord: 3 } as const;

export interface BaselineRun {
  seed: number;
  study: string[];
  test: { word: string; isOld: boolean }[];
}

export function createBaseline(seed: number, words: readonly string[] = BASELINE_WORDS_DE): BaselineRun {
  const need = BASELINE_SPEC.study + BASELINE_SPEC.lures;
  if (words.length < need) throw new RangeError(`Mindestens ${need} Wörter nötig`);
  const rng = createRng(seed);
  const picked = shuffle(words, rng).slice(0, need);
  const study = picked.slice(0, BASELINE_SPEC.study);
  const lures = picked.slice(BASELINE_SPEC.study);
  const test = shuffle(
    [...study.map((word) => ({ word, isOld: true })), ...lures.map((word) => ({ word, isOld: false }))],
    rng,
  );
  return { seed, study, test };
}

export function scoreBaseline(run: BaselineRun, saidSeen: Record<string, boolean>): SdtResult {
  let hits = 0;
  let misses = 0;
  let falseAlarms = 0;
  let correctRejections = 0;
  for (const { word, isOld } of run.test) {
    const seen = saidSeen[word] === true;
    if (isOld) seen ? hits++ : misses++;
    else seen ? falseAlarms++ : correctRejections++;
  }
  return computeSdt({ hits, misses, falseAlarms, correctRejections });
}
