"use client";

import { useEffect, useState } from "react";
import { de, fmt } from "@/i18n/de";
import { getClass } from "@/lib/teacherClient";
import type { ClassOverview } from "@/server/classes";

const t = de.teacher;

function mmss(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Große Anzeige für den Beamer: Klassen-Code und Countdown je Gruppe. */
export function Beamer({ id }: { id: string }) {
  const [o, setO] = useState<ClassOverview | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const load = () => getClass(id).then(setO).catch(() => {});
    void load();
    const poll = setInterval(load, 10_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [id]);

  if (!o) return <p>{de.common.loading}</p>;
  const started = o.startedAt ? new Date(o.startedAt).getTime() : null;

  return (
    <div className="space-y-10 py-6 text-center">
      <div>
        <p className="text-xl" style={{ color: "var(--muted)" }}>
          {t.codeHeading}
        </p>
        <p className="font-mono text-7xl font-bold tracking-[0.3em] sm:text-8xl">{o.joinCode}</p>
        <p className="mt-2 text-xl">
          {t.participants}: {o.participants.length}
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-3" aria-live="polite">
        {o.groups.map((g) => {
          const left = started !== null && now !== null ? started + g.durationMin * 60_000 - now : null;
          return (
            <div key={g.id} className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-2xl font-semibold">
                {g.label} · {g.durationMin} {de.common.minutes}
              </p>
              <p className="mt-3 text-5xl font-bold tabular-nums">
                {left === null ? t.waitingStart : left > 0 ? fmt(t.countdownLeft, { time: mmss(left) }) : "0:00"}
              </p>
              {left !== null && left <= 0 && <p className="mt-2 text-lg font-semibold">{t.countdownEnded}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
