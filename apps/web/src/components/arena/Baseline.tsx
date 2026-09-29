"use client";

import { useEffect, useMemo, useState } from "react";
import { BASELINE_SPEC, createBaseline, scoreBaseline } from "@/engine/baseline";
import type { SdtResult } from "@/engine/sdt";
import { de, fmt } from "@/i18n/de";
import { Button, StepHeading } from "@/components/ui";

const t = de.arena.baseline;

export function Baseline({ seed, onDone }: { seed: number; onDone: (r: SdtResult) => void }) {
  const run = useMemo(() => createBaseline(seed), [seed]);
  const [phase, setPhase] = useState<"intro" | "study" | "test">("intro");
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (phase !== "study") return;
    const timer = setTimeout(() => {
      if (i + 1 < run.study.length) setI(i + 1);
      else {
        setI(0);
        setPhase("test");
      }
    }, BASELINE_SPEC.studySecondsPerWord * 1000);
    return () => clearTimeout(timer);
  }, [phase, i, run.study.length]);

  if (phase === "intro") {
    return (
      <section>
        <StepHeading>{t.heading}</StepHeading>
        <p className="mb-6">{t.intro}</p>
        <Button onClick={() => setPhase("study")}>{t.start}</Button>
      </section>
    );
  }

  if (phase === "study") {
    return (
      <section aria-live="assertive">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {fmt(t.studyLabel, { n: i + 1, total: run.study.length })}
        </p>
        <p key={i} className="py-16 text-center text-5xl font-bold">
          {run.study[i]}
        </p>
      </section>
    );
  }

  const item = run.test[i]!;
  const answer = (seen: boolean) => {
    const next = { ...answers, [item.word]: seen };
    setAnswers(next);
    if (i + 1 < run.test.length) setI(i + 1);
    else onDone(scoreBaseline(run, next));
  };
  return (
    <section>
      <h2 className="text-xl font-semibold">{t.testQuestion}</h2>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {fmt(t.testProgress, { n: i + 1, total: run.test.length })}
      </p>
      <p className="py-12 text-center text-5xl font-bold" aria-live="polite">
        {item.word}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => answer(true)}>{de.common.yes}</Button>
        <Button variant="secondary" onClick={() => answer(false)}>
          {de.common.no}
        </Button>
      </div>
    </section>
  );
}
