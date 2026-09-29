"use client";

import { useMemo, useRef, useState } from "react";
import type { Quiz as QuizModel } from "@/engine/quizBuilder";
import type { QuizAnswers } from "@/engine/quizScoring";
import { createRng, shuffle } from "@/engine/rng";
import { de, fmt } from "@/i18n/de";
import { Alert, Button, StepHeading } from "@/components/ui";

const t = de.report.quiz;

type Phase = { kind: "intro" } | { kind: "content"; i: number } | { kind: "recognition"; i: number } | { kind: "order" };

export function Quiz({ quiz, onDone }: { quiz: QuizModel; onDone: (a: Omit<QuizAnswers, "prospectiveSuccess">) => void }) {
  // Inhaltsfragen gemischt, damit die Drittel-Reihenfolge nichts verrät
  const content = useMemo(() => shuffle(quiz.content, createRng(quiz.seed + 1)), [quiz]);
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  // Antworten synchron in Refs: finish() kann direkt nach der letzten Antwort laufen
  const contentAnswers = useRef<Record<string, number | null>>({});
  const recAnswers = useRef<Record<string, boolean>>({});
  const [order, setOrder] = useState<(number | null)[]>(() => quiz.order?.shown.map(() => null) ?? []);

  const recognition = quiz.recognition.some((r) => !r.isOld) ? quiz.recognition : [];

  const next = (from: Phase): void => {
    if (from.kind === "intro") return content.length ? setPhase({ kind: "content", i: 0 }) : next({ kind: "content", i: content.length });
    if (from.kind === "content") {
      if (from.i + 1 < content.length) return setPhase({ kind: "content", i: from.i + 1 });
      return recognition.length ? setPhase({ kind: "recognition", i: 0 }) : next({ kind: "recognition", i: recognition.length });
    }
    if (from.kind === "recognition") {
      if (from.i + 1 < recognition.length) return setPhase({ kind: "recognition", i: from.i + 1 });
      return quiz.order ? setPhase({ kind: "order" }) : finish();
    }
    finish();
  };

  function finish(orderPositions = order) {
    let chosen: number[] | null = null;
    if (quiz.order && orderPositions.every((p) => p !== null)) {
      chosen = [0, 1, 2].map((pos) => quiz.order!.shown[orderPositions.indexOf(pos)]?.segmentIndex ?? -1);
    }
    onDone({ content: { ...contentAnswers.current }, recognition: { ...recAnswers.current }, order: chosen });
  }

  if (phase.kind === "intro") {
    return (
      <section className="space-y-4">
        <StepHeading>{de.report.title}</StepHeading>
        <p>{t.intro}</p>
        {quiz.limited && <Alert>{t.limited}</Alert>}
        <Button onClick={() => next(phase)}>{t.start}</Button>
      </section>
    );
  }

  if (phase.kind === "content") {
    const item = content[phase.i]!;
    const q = item.question;
    const answer = (v: number | null) => {
      contentAnswers.current[q.id] = v;
      next(phase);
    };
    return (
      <section className="space-y-4" key={q.id}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {t.contentHeading} · {fmt(t.contentProgress, { n: phase.i + 1, total: content.length })}
        </p>
        <StepHeading>{q.question}</StepHeading>
        <div className="grid gap-2">
          {q.options.map((o, i) => (
            <Button key={o} variant="secondary" className="text-left" onClick={() => answer(i)}>
              {o}
            </Button>
          ))}
          <Button variant="secondary" onClick={() => answer(null)}>
            {t.dontKnow}
          </Button>
        </div>
      </section>
    );
  }

  if (phase.kind === "recognition") {
    const item = recognition[phase.i]!;
    const answer = (seen: boolean) => {
      recAnswers.current[item.id] = seen;
      next(phase);
    };
    return (
      <section className="space-y-4" key={item.id}>
        <StepHeading>{t.recognitionHeading}</StepHeading>
        <p>{t.recognitionBody}</p>
        {/* Standbilder haben keinen beschreibenden Alt-Text – er würde die Antwort verraten */}
        {/* eslint-disable-next-line @next/next/no-img-element -- Data-URL aus dem entschlüsselten Bericht, next/image bringt hier nichts */}
        <img src={item.image} alt={`Standbild ${phase.i + 1} von ${recognition.length}`} className="mx-auto max-h-80 rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => answer(true)}>{t.seen}</Button>
          <Button variant="secondary" onClick={() => answer(false)}>
            {t.notSeen}
          </Button>
        </div>
      </section>
    );
  }

  const shown = quiz.order!.shown;
  const complete = order.every((p) => p !== null) && new Set(order).size === 3;
  return (
    <section className="space-y-4">
      <StepHeading>{t.orderHeading}</StepHeading>
      <div className="grid grid-cols-3 gap-3">
        {shown.map((s, i) => (
          <div key={s.segmentIndex} className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- Data-URL aus dem entschlüsselten Bericht */}
            <img src={s.image} alt={`Video ${i + 1}`} className="w-full rounded-lg" />
            <label className="block text-sm">
              <span className="sr-only">{fmt(t.orderLabel, { n: i + 1 })}</span>
              <select
                className="min-h-11 w-full rounded-lg border px-2"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                value={order[i] ?? ""}
                onChange={(e) => setOrder((prev) => prev.map((p, j) => (j === i ? (e.target.value === "" ? null : Number(e.target.value)) : p)))}
              >
                <option value="">–</option>
                {t.orderPositions.map((label, pos) => (
                  <option key={label} value={pos}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
      <Button disabled={!complete} onClick={() => finish()}>
        {t.finish}
      </Button>
    </section>
  );
}
