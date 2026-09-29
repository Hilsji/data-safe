/**
 * Blasen-Profil: Was hat der Feed angeboten, und wo bist du hängen geblieben?
 *
 * Engagement pro Segment = w_dwell · Verweilanteil + w_like · Like + w_replay · Loops − w_skip · Skip
 * Engagement pro Kategorie = Mittelwert über die gezeigten Segmente der Kategorie.
 * Der Mittelwert normiert auf das Angebot: Eine Kategorie wird nicht „stark“, nur weil sie häufig kam.
 * Unsichere Signale (null) fließen nicht ein, sie werden also weder als 0 noch als 1 gewertet.
 */
import { CATEGORIES, type Category, type Segment } from "./types";
import { entropyCurve, type EntropyPoint } from "./entropy";

export interface EngagementWeights {
  dwell: number;
  like: number;
  replay: number;
  skip: number;
  /** Ab dieser Verweildauer (s) gilt ein Video als „voll“ angesehen (Verweilanteil = 1). */
  dwellCapSec: number;
  /** Loops zählen höchstens bis zu diesem Wert. */
  maxReplays: number;
}

export const DEFAULT_WEIGHTS: EngagementWeights = {
  dwell: 1,
  like: 0.5,
  replay: 0.5,
  skip: 0.5,
  dwellCapSec: 30,
  maxReplays: 3,
};

export function segmentEngagement(s: Segment, w: EngagementWeights = DEFAULT_WEIGHTS): number {
  const dwell = Math.min(s.watchedSec / w.dwellCapSec, 1);
  let score = w.dwell * dwell;
  if (s.liked === true) score += w.like;
  if (s.replays !== null) score += w.replay * Math.min(s.replays, w.maxReplays);
  if (s.skipped) score -= w.skip;
  return score;
}

export interface CategoryStat {
  category: Category;
  served: number;
  servedShare: number;
  watchedSec: number;
  meanEngagement: number;
  /** Engagement relativ zum Mittel aller Segmente (1 = durchschnittlich) */
  engagementIndex: number;
}

export interface BubbleProfile {
  total: number;
  categories: CategoryStat[];
  /** Top-Kategorie nach Angebot und nach Engagement */
  topServed: Category | null;
  topEngaged: Category | null;
  entropyCurve: EntropyPoint[];
  /** normierte Entropie im ersten bzw. letzten Drittel */
  entropyFirstThird: number;
  entropyLastThird: number;
}

export function buildBubbleProfile(
  segments: readonly Segment[],
  opts: { weights?: EngagementWeights; windowSize?: number; minServedForTopEngaged?: number } = {},
): BubbleProfile {
  const w = opts.weights ?? DEFAULT_WEIGHTS;
  const minServed = opts.minServedForTopEngaged ?? 3;
  const total = segments.length;
  const byCat = new Map<Category, { served: number; watched: number; engagementSum: number }>();
  let engagementTotal = 0;
  for (const s of segments) {
    const e = segmentEngagement(s, w);
    engagementTotal += e;
    const entry = byCat.get(s.category) ?? { served: 0, watched: 0, engagementSum: 0 };
    entry.served++;
    entry.watched += s.watchedSec;
    entry.engagementSum += e;
    byCat.set(s.category, entry);
  }
  const overallMean = total > 0 ? engagementTotal / total : 0;
  const categories: CategoryStat[] = [...byCat.entries()]
    .map(([category, v]) => {
      const meanEngagement = v.engagementSum / v.served;
      return {
        category,
        served: v.served,
        servedShare: v.served / total,
        watchedSec: v.watched,
        meanEngagement,
        engagementIndex: overallMean > 0 ? meanEngagement / overallMean : 0,
      };
    })
    .sort((a, b) => b.served - a.served || a.category.localeCompare(b.category));

  const topServed = categories[0]?.category ?? null;
  const engagedCandidates = categories.filter((c) => c.served >= minServed);
  const topEngaged =
    [...engagedCandidates].sort((a, b) => b.meanEngagement - a.meanEngagement)[0]?.category ?? null;

  const third = (t: 1 | 2 | 3) => segments.filter((s) => s.third === t).map((s) => ({ label: s.category, tSec: s.startSec }));
  const thirdEntropy = (t: 1 | 2 | 3) => {
    const items = third(t);
    return items.length < 2 ? 0 : (entropyCurve(items, CATEGORIES.length, items.length)[0]?.entropy ?? 0);
  };

  return {
    total,
    categories,
    topServed,
    topEngaged,
    entropyCurve: entropyCurve(
      segments.map((s) => ({ label: s.category, tSec: s.startSec })),
      CATEGORIES.length,
      opts.windowSize ?? 10,
    ),
    entropyFirstThird: thirdEntropy(1),
    entropyLastThird: thirdEntropy(3),
  };
}
