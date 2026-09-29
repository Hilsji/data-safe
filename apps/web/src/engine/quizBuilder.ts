/**
 * Quiz-Ziehung (docs/ARCHITEKTUR.md, Abschnitt 7). Die Anzahl ist fest und für 15, 30 und 45 min gleich,
 * damit Runden vergleichbar sind:
 *   - 9 Inhaltsfragen (Kern): 3 pro Session-Drittel, gemischt aus Kernaussage und Detail
 *   - 12 Wiedererkennen: 6 gesehene Standbilder (2 pro Drittel) + 6 Ablenker aus der Ablenker-Bank
 *   - 1 Reihenfolge-Aufgabe (je ein Video aus jedem Drittel)
 *   - 1 prospektive Aufgabe (wird im Client separat abgefragt)
 * Nur Segmente mit ≥ 3 s Sehdauer und keine Werbung. Reicht das Material nicht, wird ehrlich
 * weniger gefragt und die Runde als „eingeschränkt vergleichbar“ markiert.
 */
import { createRng, sample, shuffle, type Rng } from "./rng";
import type { AnalysisResult, Category, ContentQuestion, Segment, Third } from "./types";

export const QUIZ_SPEC = {
  contentPerThird: 3,
  recognitionOldPerThird: 2,
  recognitionNew: 6,
  minWatchedSec: 3,
} as const;

export interface Distractor {
  id: string;
  category: Category;
  image: string;
}

export interface ContentItem {
  kind: "content";
  segmentIndex: number;
  third: Third;
  question: ContentQuestion;
}

export interface RecognitionItem {
  kind: "recognition";
  id: string;
  image: string;
  isOld: boolean;
  third?: Third;
  segmentIndex?: number;
}

export interface OrderItem {
  kind: "order";
  /** in der Reihenfolge, in der sie angezeigt werden (gemischt) */
  shown: { segmentIndex: number; image: string }[];
  /** korrekte Reihenfolge der Segment-Indizes */
  correct: number[];
}

export interface Quiz {
  seed: number;
  content: ContentItem[];
  recognition: RecognitionItem[];
  order: OrderItem | null;
  limited: boolean;
  shortfall: { content: number; recognitionOld: number; recognitionNew: number; order: boolean };
}

const THIRDS: Third[] = [1, 2, 3];

export function eligibleSegments(segments: readonly Segment[]): Segment[] {
  return segments.filter((s) => s.kind !== "ad" && !s.skipped && s.watchedSec >= QUIZ_SPEC.minWatchedSec);
}

function pickContentForThird(segments: Segment[], n: number, rng: Rng): ContentItem[] {
  // höchstens eine Frage pro Segment; möglichst Kernaussage UND Detail
  const perSegment = shuffle(segments, rng)
    .map((s) => ({ s, qs: shuffle(s.questions.filter((q) => q.verified), rng) }))
    .filter((x) => x.qs.length > 0);
  const chosen: ContentItem[] = [];
  const wantTypes: ContentQuestion["type"][] = ["gist", "detail"];
  const used = new Set<number>();
  for (const type of wantTypes) {
    const hit = perSegment.find((x) => !used.has(x.s.index) && x.qs.some((q) => q.type === type));
    if (hit && chosen.length < n) {
      used.add(hit.s.index);
      chosen.push({ kind: "content", segmentIndex: hit.s.index, third: hit.s.third, question: hit.qs.find((q) => q.type === type)! });
    }
  }
  for (const x of perSegment) {
    if (chosen.length >= n) break;
    if (used.has(x.s.index)) continue;
    used.add(x.s.index);
    chosen.push({ kind: "content", segmentIndex: x.s.index, third: x.s.third, question: x.qs[0]! });
  }
  return chosen;
}

export function buildQuiz(
  result: Pick<AnalysisResult, "segments">,
  distractorBank: readonly Distractor[],
  seed: number,
): Quiz {
  const rng = createRng(seed);
  const eligible = eligibleSegments(result.segments);
  const byThird = (t: Third) => eligible.filter((s) => s.third === t);

  const content = THIRDS.flatMap((t) => pickContentForThird(byThird(t), QUIZ_SPEC.contentPerThird, rng));

  const withImage = (t: Third) => byThird(t).filter((s) => s.keyframe);
  const oldSegments = THIRDS.flatMap((t) => sample(withImage(t), QUIZ_SPEC.recognitionOldPerThird, rng));
  const old: RecognitionItem[] = oldSegments.map((s) => ({
    kind: "recognition",
    id: `seg-${s.index}`,
    image: s.keyframe!,
    isOld: true,
    third: s.third,
    segmentIndex: s.index,
  }));

  // Ablenker bevorzugt aus denselben Kategorien wie die gesehenen Items → keine „Stil-Hinweise“
  const oldCats = new Set(oldSegments.map((s) => s.category));
  const matching = shuffle(distractorBank.filter((d) => oldCats.has(d.category)), rng);
  const rest = shuffle(distractorBank.filter((d) => !oldCats.has(d.category)), rng);
  const distractors = [...matching, ...rest].slice(0, QUIZ_SPEC.recognitionNew);
  const fresh: RecognitionItem[] = distractors.map((d) => ({ kind: "recognition", id: `dis-${d.id}`, image: d.image, isOld: false }));

  const usedForRecognition = new Set(oldSegments.map((s) => s.index));
  const orderPicks = THIRDS.map((t) => {
    const candidates = withImage(t).filter((s) => !usedForRecognition.has(s.index));
    return sample(candidates.length > 0 ? candidates : withImage(t), 1, rng)[0];
  });
  const order: OrderItem | null = orderPicks.every((s) => s !== undefined)
    ? {
        kind: "order",
        correct: orderPicks.map((s) => s!.index),
        shown: shuffle(orderPicks.map((s) => ({ segmentIndex: s!.index, image: s!.keyframe! })), rng),
      }
    : null;

  const shortfall = {
    content: QUIZ_SPEC.contentPerThird * 3 - content.length,
    recognitionOld: QUIZ_SPEC.recognitionOldPerThird * 3 - old.length,
    recognitionNew: QUIZ_SPEC.recognitionNew - fresh.length,
    order: order === null,
  };
  return {
    seed,
    content,
    recognition: shuffle([...old, ...fresh], rng),
    order,
    limited: shortfall.content > 0 || shortfall.recognitionOld > 0 || shortfall.recognitionNew > 0 || shortfall.order,
    shortfall,
  };
}
