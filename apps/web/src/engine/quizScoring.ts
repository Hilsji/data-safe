/**
 * Auswertung „So viel ist hängen geblieben“. Vergleich nur mit sich selbst (Baseline), keine Normwerte.
 */
import { computeSdt, type SdtResult } from "./sdt";
import type { Quiz } from "./quizBuilder";
import type { Third } from "./types";

export interface QuizAnswers {
  /** Index der gewählten Option je Inhaltsfrage-ID; null = „weiß nicht“ */
  content: Record<string, number | null>;
  /** „gesehen“ (true) / „nicht gesehen“ (false) je Recognition-ID */
  recognition: Record<string, boolean>;
  /** gewählte Reihenfolge der Segment-Indizes */
  order: number[] | null;
  prospectiveSuccess: boolean | null;
}

export interface Rate {
  correct: number;
  total: number;
  /** null, wenn keine Fragen vorhanden waren */
  share: number | null;
}

export interface QuizScore {
  content: Rate;
  contentByThird: Record<Third, Rate>;
  contentByType: { gist: Rate; detail: Rate };
  recognition: SdtResult | null;
  orderCorrect: boolean | null;
  prospectiveSuccess: boolean | null;
  /** d′ im Quiz minus d′ der Baseline; null ohne Baseline oder ohne Wiedererkennen */
  deltaToBaseline: number | null;
  limited: boolean;
}

function rate(correct: number, total: number): Rate {
  return { correct, total, share: total > 0 ? correct / total : null };
}

export function scoreQuiz(quiz: Quiz, answers: QuizAnswers, baselineDPrime: number | null): QuizScore {
  const tally = (filter: (c: Quiz["content"][number]) => boolean) => {
    const items = quiz.content.filter(filter);
    const correct = items.filter((c) => answers.content[c.question.id] === c.question.correctIndex).length;
    return rate(correct, items.length);
  };

  let hits = 0;
  let misses = 0;
  let falseAlarms = 0;
  let correctRejections = 0;
  for (const r of quiz.recognition) {
    const saidSeen = answers.recognition[r.id] === true;
    if (r.isOld) saidSeen ? hits++ : misses++;
    else saidSeen ? falseAlarms++ : correctRejections++;
  }
  const recognition =
    hits + misses > 0 && falseAlarms + correctRejections > 0 ? computeSdt({ hits, misses, falseAlarms, correctRejections }) : null;

  const orderCorrect =
    quiz.order === null || answers.order === null
      ? null
      : answers.order.length === quiz.order.correct.length && answers.order.every((v, i) => v === quiz.order!.correct[i]);

  return {
    content: tally(() => true),
    contentByThird: { 1: tally((c) => c.third === 1), 2: tally((c) => c.third === 2), 3: tally((c) => c.third === 3) },
    contentByType: { gist: tally((c) => c.question.type === "gist"), detail: tally((c) => c.question.type === "detail") },
    recognition,
    orderCorrect,
    prospectiveSuccess: answers.prospectiveSuccess,
    deltaToBaseline: recognition && baselineDPrime !== null ? recognition.dPrime - baselineDPrime : null,
    limited: quiz.limited,
  };
}
