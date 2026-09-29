/**
 * Kennzahlen für das Lehrer-Dashboard aus den anonymen Histogrammen.
 * Mittelwerte sind Näherungen über die Bucket-Mitten – genauer geht es bewusst nicht,
 * weil der Server nie Einzelwerte bekommt.
 */
import { BUCKETS } from "./aggregate";

export interface GroupCounts {
  n: number;
  contentCorrectHist: number[];
  recognitionDPrimeHist: number[];
  videosSeenHist: number[];
  prospectiveSuccess: number;
  prospectiveTotal: number;
  topCategoryCounts: Record<string, number>;
  entropyDropHist: number[];
}

export interface GroupStats {
  n: number;
  /** 0–1, Näherung */
  contentCorrectMean: number | null;
  dPrimeMean: number | null;
  videosSeenMean: number | null;
  prospectiveRate: number | null;
  /** positiv = Themenvielfalt ist gesunken */
  entropyDropMean: number | null;
  topCategories: { category: string; count: number }[];
}

function histMean(hist: number[], midpoint: (i: number) => number): number | null {
  const total = hist.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return hist.reduce((sum, c, i) => sum + c * midpoint(i), 0) / total;
}

export function groupStats(g: GroupCounts): GroupStats {
  return {
    n: g.n,
    contentCorrectMean: histMean(g.contentCorrectHist, (i) => (i + 0.5) / BUCKETS.pct),
    dPrimeMean: histMean(g.recognitionDPrimeHist, (i) => BUCKETS.dPrimeMin + (i + 0.5) * BUCKETS.dPrimeStep),
    // letzter Bucket ist offen („200+“) – dort wird die Untergrenze verwendet
    videosSeenMean: histMean(g.videosSeenHist, (i) => (i === BUCKETS.videosBuckets - 1 ? i * BUCKETS.videosStep : (i + 0.5) * BUCKETS.videosStep)),
    prospectiveRate: g.prospectiveTotal > 0 ? g.prospectiveSuccess / g.prospectiveTotal : null,
    entropyDropMean: histMean(g.entropyDropHist, (i) => BUCKETS.entropyMin + (i + 0.5) * BUCKETS.entropyStep),
    topCategories: Object.entries(g.topCategoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
  };
}
