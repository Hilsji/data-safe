/**
 * Themenvielfalt als Shannon-Entropie H = −Σ pᵢ log₂ pᵢ (Arbeitspapier Tab. 12: „Feed-Diversität“).
 * Normiert auf 0…1, damit Fenster unterschiedlicher Größe vergleichbar sind.
 */

export function shannonEntropy(counts: Iterable<number>): number {
  const values = [...counts].filter((c) => c > 0);
  const total = values.reduce((s, c) => s + c, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const c of values) {
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * Normierte Entropie: H / log₂(min(n, k)). Maximal erreichbar ist bei n Beobachtungen und
 * k möglichen Kategorien nur log₂(min(n, k)) – so bedeutet 1 immer „so vielfältig wie möglich“.
 */
export function normalizedEntropy<T>(labels: readonly T[], categoryCount: number): number {
  const maxDistinct = Math.min(labels.length, categoryCount);
  if (maxDistinct <= 1) return 0;
  const counts = new Map<T, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  return shannonEntropy(counts.values()) / Math.log2(maxDistinct);
}

export interface EntropyPoint {
  /** Index des letzten Segments im Fenster */
  index: number;
  tSec: number;
  entropy: number;
}

/** Verengungskurve: normierte Entropie in einem gleitenden Fenster über die Session. */
export function entropyCurve<T>(
  items: readonly { label: T; tSec: number }[],
  categoryCount: number,
  windowSize = 10,
): EntropyPoint[] {
  if (windowSize < 2) throw new RangeError("windowSize muss ≥ 2 sein");
  const points: EntropyPoint[] = [];
  for (let end = windowSize; end <= items.length; end++) {
    const window = items.slice(end - windowSize, end);
    points.push({
      index: end - 1,
      tSec: window[window.length - 1]!.tSec,
      entropy: normalizedEntropy(
        window.map((w) => w.label),
        categoryCount,
      ),
    });
  }
  return points;
}
