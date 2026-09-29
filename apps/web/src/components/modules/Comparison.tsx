"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Card } from "@/components/ui";
import { futureSelf, MAX_MINUTES_PER_DAY } from "@/engine/timeCalculator";
import { de, fmt } from "@/i18n/de";

const t = de.comparison;
const nf = (n: number, digits = 0) => n.toLocaleString("de-DE", { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** Survivorship Bias als Grafik: ein sichtbarer Punkt, viele unsichtbare. Symbolisch, ohne Zahl. */
function SurvivorGraphic() {
  return (
    <figure aria-hidden="true" className="flex items-center gap-4">
      <svg viewBox="0 0 220 60" className="h-16 w-auto">
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={10 + (i % 20) * 10} cy={i < 20 ? 20 : 40} r="3.5" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="2 2" />
        ))}
        <circle cx={110} cy={20} r="6" fill="var(--series-2)" />
      </svg>
      <figcaption className="space-y-1 text-sm">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: "var(--series-2)" }} /> {t.survivorVisible}
        </span>
        <span className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
          <span className="inline-block h-3 w-3 rounded-full border border-dashed" style={{ borderColor: "var(--muted)" }} /> {t.survivorHidden}
        </span>
      </figcaption>
    </figure>
  );
}

function Timeline({ label, hours, emphasis }: { label: string; hours: number; emphasis: boolean }) {
  return (
    <div>
      <p className="font-semibold">{label}</p>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {fmt(t.perYear, { hours: nf(hours) })}
      </p>
      <div className="mt-1 h-4 rounded" style={{ background: "var(--grid)" }} aria-hidden="true">
        <div className="h-full rounded" style={{ width: `${Math.min(100, (hours / (MAX_MINUTES_PER_DAY * 365 / 60 / 4)) * 100)}%`, background: emphasis ? "var(--series-1)" : "var(--muted)" }} />
      </div>
    </div>
  );
}

export function Comparison() {
  const [minutes, setMinutes] = useState("");
  const m = Number(minutes);
  const valid = minutes !== "" && Number.isFinite(m) && m >= 0 && m <= MAX_MINUTES_PER_DAY;
  const future = valid ? futureSelf(m) : null;
  const tutoring = future?.equivalents.find((e) => e.equivalent.id === "tutoring");

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">{t.upwardHeading}</h2>
        <p>{t.upwardBody}</p>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-xl font-bold">{t.survivorHeading}</h2>
        <SurvivorGraphic />
        <p>{t.survivorBody}</p>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">{t.calcHeading}</h2>
        <label className="block">
          <span className="font-semibold">{t.calcLabel}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_MINUTES_PER_DAY}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            aria-describedby="calc-hint"
            className="mt-1 block min-h-11 w-32 rounded-lg border px-3 text-lg"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          />
          <span id="calc-hint" className="text-sm" style={{ color: "var(--muted)" }}>
            {t.calcHint}
          </span>
        </label>
        {future && (
          <div aria-live="polite" className="space-y-4">
            <p>
              {fmt(t.perYear, { hours: nf(future.current.hoursPerYear) })} {fmt(t.perYearDays, { days: nf(future.current.hoursPerYear / 24, 1) })}
            </p>
            <h3 className="text-lg font-semibold">{t.futureHeading}</h3>
            <Timeline label={t.futureSame} hours={future.current.hoursPerYear} emphasis={false} />
            <Timeline label={t.futureLess} hours={future.reduced.hoursPerYear} emphasis />
            <Alert tone="success">
              <p>{fmt(t.gained, { hours: nf(future.gainedHoursPerYear) })}</p>
              {tutoring && <p>{fmt(t.tutoring, { n: nf(tutoring.times) })}</p>}
            </Alert>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {t.equivalentsTodo}
            </p>
            <div>
              <h3 className="font-semibold">{t.ideasHeading}</h3>
              <ul className="list-disc space-y-1 pl-5">
                {t.ideas.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
            <p className="italic">{t.fearNote}</p>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">{t.actionHeading}</h2>
        <ul className="space-y-2">
          {t.actions.map((a) => (
            <li key={a} className="flex gap-2">
              <span aria-hidden="true">☐</span>
              {a}
            </li>
          ))}
        </ul>
      </Card>
      <Link href="/arena" className="inline-block underline">
        {t.toArena}
      </Link>
    </div>
  );
}
