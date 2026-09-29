import { describe, expect, it } from "vitest";
import { buildQuiz, QUIZ_SPEC, type Distractor } from "./quizBuilder";
import { scoreQuiz, type QuizAnswers } from "./quizScoring";
import { question, segment, session } from "../../tests/unit/fixtures";

const bank: Distractor[] = Array.from({ length: 20 }, (_, i) => ({
  id: `d${i}`,
  category: (["comedy", "sport", "gaming", "food"] as const)[i % 4]!,
  image: `data:image/jpeg;base64,dis${i}`,
}));

describe("buildQuiz", () => {
  it.each([30, 90, 180])("hat bei %i Segmenten immer dieselbe feste Anzahl", (n) => {
    const quiz = buildQuiz({ segments: session(n) }, bank, 1);
    expect(quiz.content).toHaveLength(9);
    expect(quiz.recognition.filter((r) => r.isOld)).toHaveLength(6);
    expect(quiz.recognition.filter((r) => !r.isOld)).toHaveLength(6);
    expect(quiz.order?.correct).toHaveLength(3);
    expect(quiz.limited).toBe(false);
  });

  it("zieht gleichmäßig aus Anfang, Mitte und Ende", () => {
    const quiz = buildQuiz({ segments: session(60) }, bank, 7);
    for (const t of [1, 2, 3] as const) {
      expect(quiz.content.filter((c) => c.third === t)).toHaveLength(QUIZ_SPEC.contentPerThird);
      expect(quiz.recognition.filter((r) => r.isOld && r.third === t)).toHaveLength(QUIZ_SPEC.recognitionOldPerThird);
    }
    const thirds = quiz.order!.correct.map((i) => session(60)[i]!.third);
    expect(thirds).toEqual([1, 2, 3]);
  });

  it("mischt Kernaussage und Detail in jedem Drittel", () => {
    const quiz = buildQuiz({ segments: session(60) }, bank, 3);
    for (const t of [1, 2, 3] as const) {
      const types = new Set(quiz.content.filter((c) => c.third === t).map((c) => c.question.type));
      expect(types).toEqual(new Set(["gist", "detail"]));
    }
  });

  it("nutzt nur Videos ≥ 3 s, keine Skips, keine Werbung, nur geprüfte Fragen", () => {
    const segs = session(60).map((s, i) =>
      i % 4 === 0 ? { ...s, watchedSec: 2.5 } : i % 4 === 1 ? { ...s, kind: "ad" as const } : i % 4 === 2 ? { ...s, questions: [question("gist", false)] } : s,
    );
    const quiz = buildQuiz({ segments: segs }, bank, 11);
    for (const c of quiz.content) {
      const seg = segs[c.segmentIndex]!;
      expect(seg.watchedSec).toBeGreaterThanOrEqual(3);
      expect(seg.kind).not.toBe("ad");
      expect(c.question.verified).toBe(true);
    }
    for (const r of quiz.recognition.filter((x) => x.isOld)) {
      expect(segs[r.segmentIndex!]!.watchedSec).toBeGreaterThanOrEqual(3);
    }
  });

  it("stellt höchstens eine Inhaltsfrage pro Video", () => {
    const quiz = buildQuiz({ segments: session(60) }, bank, 5);
    const idx = quiz.content.map((c) => c.segmentIndex);
    expect(new Set(idx).size).toBe(idx.length);
  });

  it("Ablenker stammen nie aus der eigenen Session", () => {
    const quiz = buildQuiz({ segments: session(60) }, bank, 9);
    for (const r of quiz.recognition.filter((x) => !x.isOld)) {
      expect(r.id.startsWith("dis-")).toBe(true);
      expect(r.segmentIndex).toBeUndefined();
    }
  });

  it("markiert zu kurze Sessions als eingeschränkt vergleichbar", () => {
    const quiz = buildQuiz({ segments: session(4) }, bank, 1);
    expect(quiz.limited).toBe(true);
    expect(quiz.shortfall.content).toBeGreaterThan(0);
  });

  it("ist bei gleichem Seed reproduzierbar", () => {
    const segments = session(60);
    const a = buildQuiz({ segments }, bank, 42);
    const b = buildQuiz({ segments }, bank, 42);
    expect(a).toEqual(b);
  });
});

describe("scoreQuiz", () => {
  const quiz = buildQuiz({ segments: session(60) }, bank, 2);

  function answers(allCorrect: boolean): QuizAnswers {
    return {
      content: Object.fromEntries(quiz.content.map((c) => [c.question.id, allCorrect ? c.question.correctIndex : null])),
      recognition: Object.fromEntries(quiz.recognition.map((r) => [r.id, allCorrect ? r.isOld : !r.isOld])),
      order: allCorrect ? quiz.order!.correct : [...quiz.order!.correct].reverse(),
      prospectiveSuccess: allCorrect,
    };
  }

  it("wertet alles richtig", () => {
    const s = scoreQuiz(quiz, answers(true), 1);
    expect(s.content).toEqual({ correct: 9, total: 9, share: 1 });
    expect(s.contentByThird[2]).toEqual({ correct: 3, total: 3, share: 1 });
    expect(s.recognition!.hitRate).toBe(1);
    expect(s.recognition!.falseAlarmRate).toBe(0);
    expect(s.orderCorrect).toBe(true);
    expect(s.deltaToBaseline).toBeCloseTo(s.recognition!.dPrime - 1, 12);
  });

  it("wertet alles falsch; „weiß nicht“ zählt als nicht gewusst", () => {
    const s = scoreQuiz(quiz, answers(false), null);
    expect(s.content.correct).toBe(0);
    expect(s.recognition!.dPrime).toBeLessThan(0);
    expect(s.orderCorrect).toBe(false);
    expect(s.deltaToBaseline).toBeNull();
  });

  it("zählt Kernaussage und Detail getrennt", () => {
    const s = scoreQuiz(quiz, answers(true), null);
    expect(s.contentByType.gist.total + s.contentByType.detail.total).toBe(9);
  });

  it("gibt null zurück, wenn es keine Reihenfolge-Aufgabe gab", () => {
    const small = buildQuiz({ segments: [segment(0)] }, bank, 1);
    expect(scoreQuiz(small, { content: {}, recognition: {}, order: null, prospectiveSuccess: null }, null).orderCorrect).toBeNull();
  });
});
