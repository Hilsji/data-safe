/**
 * Validierung des Klassifikators (Admin-Tool). Zwei Rater taggen Kalibrier-Segmente unabhängig;
 * verglichen wird Mensch–Mensch und Mensch–Modell. Die Politik-Richtung wird nur freigegeben,
 * wenn alle Schwellen aus Entscheidung E6 erfüllt sind (docs/ARCHITEKTUR.md, Abschnitt 12 und v3).
 */
import { cohensKappa } from "./kappa";
import type { Category, Spectrum } from "./types";

export const E6 = {
  minKappa: 0.6,
  minRecallPerSpectrum: 0.7,
  maxRecallGap: 0.15,
  /** unter so vielen Konsens-Segmenten je Spektrum ist keine Aussage möglich */
  minConsensusPerSpectrum: 10,
} as const;

/** Nur diese Spektren werden bewertet; „nicht zuordenbar“ ist keine Richtung. */
export const RATED_SPECTRA: Spectrum[] = ["left", "center_left", "center", "center_right", "right"];
/** Paare, deren Erkennungsraten sich nicht zu stark unterscheiden dürfen (Symmetrie links/rechts) */
export const MIRROR_PAIRS: [Spectrum, Spectrum][] = [
  ["left", "right"],
  ["center_left", "center_right"],
];

export interface ValidationSegment {
  id: string;
  model: { category: Category; spectrum?: Spectrum };
  tags: { raterId: string; category: Category; spectrum?: Spectrum; boundaryOk: boolean; likeOk: boolean; replayOk: boolean }[];
}

export interface KappaStat {
  kappa: number | null;
  n: number;
}

export interface ValidationReport {
  segments: number;
  doubleTagged: number;
  category: { humanHuman: KappaStat; humanModel: KappaStat };
  spectrum: { humanHuman: KappaStat; humanModel: KappaStat };
  recallPerSpectrum: Record<string, { recall: number | null; n: number }>;
  mirrorGaps: { pair: [Spectrum, Spectrum]; gap: number | null }[];
  signalAccuracy: { boundary: number | null; like: number | null; replay: number | null };
  politicsApprovable: boolean;
  reasons: string[];
}

const kappaOf = <T,>(pairs: [T, T][]): KappaStat => ({ kappa: pairs.length ? cohensKappa(pairs).kappa : null, n: pairs.length });
const share = (xs: boolean[]) => (xs.length ? xs.filter(Boolean).length / xs.length : null);

export function buildValidationReport(segments: readonly ValidationSegment[]): ValidationReport {
  const double = segments.filter((s) => s.tags.length >= 2);
  const first2 = (s: ValidationSegment) => [s.tags[0]!, s.tags[1]!] as const;

  // Kategorie
  const catHH: [Category, Category][] = double.map((s) => [first2(s)[0].category, first2(s)[1].category]);
  const catConsensus = double.filter((s) => first2(s)[0].category === first2(s)[1].category);
  const catHM: [Category, Category][] = catConsensus.map((s) => [s.tags[0]!.category, s.model.category]);

  // Spektrum – nur wo beide Rater „Politik“ sagen
  const pol = double.filter((s) => first2(s)[0].category === "politics" && first2(s)[1].category === "politics");
  const specOf = (x: { spectrum?: Spectrum }) => x.spectrum ?? "unassignable";
  const specHH: [Spectrum, Spectrum][] = pol.map((s) => [specOf(first2(s)[0]), specOf(first2(s)[1])]);
  const specConsensus = pol.filter((s) => specOf(first2(s)[0]) === specOf(first2(s)[1]));
  const specHM: [Spectrum, Spectrum][] = specConsensus.map((s) => [specOf(s.tags[0]!), specOf(s.model)]);

  const recallPerSpectrum: ValidationReport["recallPerSpectrum"] = {};
  for (const sp of RATED_SPECTRA) {
    const items = specConsensus.filter((s) => specOf(s.tags[0]!) === sp);
    recallPerSpectrum[sp] = { recall: share(items.map((s) => specOf(s.model) === sp)), n: items.length };
  }
  const mirrorGaps = MIRROR_PAIRS.map(([a, b]) => {
    const ra = recallPerSpectrum[a]!.recall;
    const rb = recallPerSpectrum[b]!.recall;
    return { pair: [a, b] as [Spectrum, Spectrum], gap: ra === null || rb === null ? null : Math.abs(ra - rb) };
  });

  const allTags = segments.flatMap((s) => s.tags);
  const report: ValidationReport = {
    segments: segments.length,
    doubleTagged: double.length,
    category: { humanHuman: kappaOf(catHH), humanModel: kappaOf(catHM) },
    spectrum: { humanHuman: kappaOf(specHH), humanModel: kappaOf(specHM) },
    recallPerSpectrum,
    mirrorGaps,
    signalAccuracy: {
      boundary: share(allTags.map((t) => t.boundaryOk)),
      like: share(allTags.map((t) => t.likeOk)),
      replay: share(allTags.map((t) => t.replayOk)),
    },
    politicsApprovable: false,
    reasons: [],
  };

  const r = report.reasons;
  const k = (x: KappaStat, label: string) => {
    if (x.kappa === null) r.push(`${label}: keine Daten`);
    else if (x.kappa < E6.minKappa) r.push(`${label}: κ ${x.kappa.toFixed(2)} < ${E6.minKappa}`);
  };
  k(report.spectrum.humanHuman, "Spektrum Mensch–Mensch");
  k(report.spectrum.humanModel, "Spektrum Mensch–Modell");
  for (const sp of RATED_SPECTRA) {
    const { recall, n } = recallPerSpectrum[sp]!;
    if (n < E6.minConsensusPerSpectrum) r.push(`${sp}: nur ${n} Konsens-Segmente (mind. ${E6.minConsensusPerSpectrum})`);
    else if (recall !== null && recall < E6.minRecallPerSpectrum) r.push(`${sp}: Recall ${recall.toFixed(2)} < ${E6.minRecallPerSpectrum}`);
  }
  for (const g of mirrorGaps) {
    if (g.gap !== null && g.gap > E6.maxRecallGap) r.push(`Schieflage ${g.pair.join("/")}: ${g.gap.toFixed(2)} > ${E6.maxRecallGap}`);
  }
  report.politicsApprovable = r.length === 0;
  return report;
}
