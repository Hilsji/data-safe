import { FACTS, type FactId } from "@/content/facts";
import { DURATIONS } from "@/engine/types";

const num = (n: number) => n.toLocaleString("de-DE");

type ChartFact = { numbers?: readonly number[]; numberLabels?: readonly string[]; unit?: string; label: string };

/** Balken aus den Diagramm-Werten eines Fakts (Zahlen nur aus der Registry). */
export function FactBars({ id, max }: { id: FactId; max?: number }) {
  const f = FACTS[id] as ChartFact;
  if (!f.numbers) return null;
  const top = max ?? Math.max(...f.numbers);
  return (
    <dl className="space-y-2" aria-label={f.label}>
      {f.numbers.map((v, i) => (
        <div key={i} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-2">
          <dt className="text-sm">{f.numberLabels?.[i]}</dt>
          <dd className="h-4 rounded" style={{ background: "var(--grid)" }} aria-hidden="true">
            <div className="h-full rounded" style={{ width: `${(v / top) * 100}%`, background: "var(--series-1)" }} />
          </dd>
          <dd className="text-right text-sm tabular-nums">
            {num(v)} {f.unit}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Zeitstrahl bis zur längsten Rundenlänge: Markierungen aus dem Fakt, dazu die Rundenlängen der App. */
export function FactTimeline({ id, range = false }: { id: FactId; range?: boolean }) {
  const f = FACTS[id] as ChartFact;
  if (!f.numbers) return null;
  const maxMin = DURATIONS[DURATIONS.length - 1]!;
  const x = (m: number) => `${(m / maxMin) * 100}%`;
  const markers = range
    ? [{ from: f.numbers[0]!, to: f.numbers[1]!, label: f.numberLabels?.[0] ?? "" }]
    : f.numbers.map((n, i) => ({ from: n, to: n, label: f.numberLabels?.[i] ?? "" }));
  return (
    <div className="px-8 pt-12 pb-8" aria-hidden="true">
      <div className="relative h-2 rounded" style={{ background: "var(--grid)" }}>
        {DURATIONS.map((d) => (
          <span key={d} className="absolute top-3 -translate-x-1/2 whitespace-nowrap text-xs" style={{ left: x(d), color: "var(--muted)" }}>
            {d} min
          </span>
        ))}
        {markers.map((m, i) => (
          <div key={i}>
            <div
              className="absolute -top-1 h-4 rounded"
              style={{ left: x(m.from), width: `max(4px, ${((m.to - m.from) / maxMin) * 100}%)`, background: "var(--series-2)" }}
            />
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap text-xs font-semibold"
              style={{ left: x(m.from), top: i % 2 ? "-2.8rem" : "-1.6rem" }}
            >
              {m.label} · {m.from === m.to ? m.from : `${m.from}–${m.to}`} min
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
