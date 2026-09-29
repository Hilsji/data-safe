"use client";

import { useId, useState, type ReactNode } from "react";

/* Gemeinsame Regeln (siehe dataviz-Richtlinie): dünne Linien (2px), Marker ≥ 8px, Legende ab 2 Reihen,
 * Texte in Text-Farben (nie in Reihenfarbe), Tooltip bei Hover/Fokus, Tabellenansicht als Alternative. */

const pct = (v: number) => `${Math.round(v * 100)} %`;

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-4 text-sm" style={{ color: "var(--muted)" }}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <svg width="20" height="10" aria-hidden="true">
            <line x1="0" y1="5" x2="20" y2="5" stroke={i.color} strokeWidth="2" strokeDasharray={i.dashed ? "4 3" : undefined} />
            <circle cx="10" cy="5" r="4" fill={i.color} />
          </svg>
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** x/y als CSS-Position relativ zum Diagramm, z. B. "40%" */
function Tooltip({ x, y, children }: { x: string; y: string; children: ReactNode }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1 text-xs shadow"
      style={{ left: x, top: `calc(${y} - 8px)`, background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radar
// ---------------------------------------------------------------------------

export interface RadarAxis {
  label: string;
  /** 0–1 */
  a: number;
  /** 0–1 */
  b: number;
  /** Anzeige-Texte für Tooltip und Tabelle */
  aText: string;
  bText: string;
}

export function RadarChart({
  axes,
  aLabel,
  bLabel,
  title,
  summary,
  tableHeaders,
  tableToggle,
}: {
  axes: RadarAxis[];
  aLabel: string;
  bLabel: string;
  title: string;
  summary: string;
  tableHeaders: [string, string, string];
  tableToggle: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const descId = useId();
  const size = 320;
  const c = size / 2;
  const r = size / 2 - 56;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(ang) * r * v, c + Math.sin(ang) * r * v] as const;
  };
  const poly = (key: "a" | "b") => axes.map((ax, i) => pt(i, ax[key]).join(",")).join(" ");

  return (
    <figure className="relative">
      <figcaption className="mb-1 font-semibold">{title}</figcaption>
      <Legend items={[{ label: aLabel, color: "var(--series-1)" }, { label: bLabel, color: "var(--series-2)", dashed: true }]} />
      <p id={descId} className="sr-only">
        {summary}
      </p>
      {n >= 3 && (
        <div className="relative mx-auto max-w-sm">
          <svg viewBox={`0 0 ${size} ${size}`} role="group" aria-labelledby={descId} className="w-full overflow-visible">
            {[0.25, 0.5, 0.75, 1].map((lv) => (
              <polygon key={lv} points={axes.map((_, i) => pt(i, lv).join(",")).join(" ")} fill="none" stroke="var(--grid)" strokeWidth="1" />
            ))}
            {axes.map((ax, i) => {
              const [x, y] = pt(i, 1);
              const [lx, ly] = pt(i, 1.18);
              return (
                <g key={ax.label}>
                  <line x1={c} y1={c} x2={x} y2={y} stroke="var(--grid)" strokeWidth="1" />
                  <text x={lx} y={ly} textAnchor={Math.abs(lx - c) < 8 ? "middle" : lx > c ? "start" : "end"} dominantBaseline="middle" fontSize="11" fill="var(--muted)">
                    {ax.label}
                  </text>
                </g>
              );
            })}
            <polygon points={poly("a")} fill="var(--series-1)" fillOpacity="0.12" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />
            <polygon points={poly("b")} fill="none" stroke="var(--series-2)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
            {axes.map((ax, i) => (
              <g key={ax.label}>
                {(["a", "b"] as const).map((k) => {
                  const [x, y] = pt(i, ax[k]);
                  return <circle key={k} cx={x} cy={y} r="4" fill={k === "a" ? "var(--series-1)" : "var(--series-2)"} stroke="var(--surface)" strokeWidth="2" />;
                })}
                {/* großes Trefferfeld je Achse für Hover/Fokus */}
                <circle
                  cx={pt(i, 0.6)[0]}
                  cy={pt(i, 0.6)[1]}
                  r="22"
                  fill="transparent"
                  role="img"
                  tabIndex={0}
                  aria-label={`${ax.label}: ${aLabel} ${ax.aText}, ${bLabel} ${ax.bText}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            ))}
          </svg>
          {hover !== null && (
            <Tooltip x={`${(pt(hover, 0.6)[0] / size) * 100}%`} y={`${(pt(hover, 0.6)[1] / size) * 100}%`}>
              <strong>{axes[hover]!.label}</strong>
              <br />
              {aLabel}: {axes[hover]!.aText}
              <br />
              {bLabel}: {axes[hover]!.bText}
            </Tooltip>
          )}
        </div>
      )}
      <DataTable
        toggle={tableToggle}
        open={showTable || n < 3}
        onToggle={() => setShowTable(!showTable)}
        headers={tableHeaders}
        rows={axes.map((a) => [a.label, a.aText, a.bText])}
      />
    </figure>
  );
}

function DataTable({ toggle, open, onToggle, headers, rows }: { toggle: string; open: boolean; onToggle: () => void; headers: string[]; rows: string[][] }) {
  return (
    <div className="mt-2">
      <button type="button" className="min-h-11 text-sm underline" aria-expanded={open} onClick={onToggle}>
        {toggle}
      </button>
      {open && (
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col" className="border-b py-1 pr-2" style={{ borderColor: "var(--border)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>
                {r.map((cell, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="py-1 pr-2 font-normal">
                      {cell}
                    </th>
                  ) : (
                    <td key={i} className="py-1 pr-2 tabular-nums">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linie (Verengungskurve)
// ---------------------------------------------------------------------------

export function LineChart({
  points,
  title,
  summary,
  xLabel,
  valueLabel,
}: {
  points: { x: number; y: number }[];
  title: string;
  summary: string;
  xLabel: (x: number) => string;
  valueLabel: (y: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const descId = useId();
  const W = 600;
  const H = 220;
  const pad = { l: 12, r: 12, t: 16, b: 12 };
  if (points.length < 2) return null;
  const xMin = points[0]!.x;
  const xMax = points[points.length - 1]!.x || 1;
  const sx = (x: number) => pad.l + ((x - xMin) / Math.max(xMax - xMin, 1)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - y) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * (W - pad.l - pad.r) + pad.l;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(sx(p.x) - x) < Math.abs(sx(points[best]!.x) - x)) best = i;
    });
    setHover(best);
  };
  const hp = hover !== null ? points[hover]! : null;
  return (
    <figure className="relative">
      <figcaption className="mb-1 font-semibold">{title}</figcaption>
      <p id={descId} className="sr-only">
        {summary}
      </p>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={descId} className="w-full">
          {[0, 0.5, 1].map((g) => (
            <line key={g} x1={pad.l} x2={W - pad.r} y1={sy(g)} y2={sy(g)} stroke="var(--grid)" strokeWidth="1" />
          ))}
          <path d={d} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {hp && (
            <g>
              <line x1={sx(hp.x)} x2={sx(hp.x)} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={sx(hp.x)} cy={sy(hp.y)} r="5" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
            </g>
          )}
          <rect
            x={pad.l}
            y={0}
            width={W - pad.l - pad.r}
            height={H}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {/* Achsenenden als HTML-Text: bleibt auf dem Handy lesbar, statt mit dem SVG zu schrumpfen */}
        <div className="flex justify-between text-sm" style={{ color: "var(--muted)" }} aria-hidden="true">
          <span>{xLabel(xMin)}</span>
          <span>{xLabel(xMax)}</span>
        </div>
        {hp && (
          <Tooltip x={`${(sx(hp.x) / W) * 100}%`} y={`${(sy(hp.y) / H) * 100}%`}>
            {xLabel(hp.x)}: {valueLabel(hp.y)}
          </Tooltip>
        )}
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Balken
// ---------------------------------------------------------------------------

/** Zwei-Teile-Balken „hängen geblieben vs. verpufft“ (Hervorhebung + neutrale Restfläche, 2px Lücke). */
export function SplitBar({ share, aLabel, bLabel }: { share: number; aLabel: string; bLabel: string }) {
  const a = Math.max(0, Math.min(1, share));
  return (
    <div>
      <div className="flex h-6 w-full gap-[2px]" role="img" aria-label={`${aLabel} ${pct(a)}, ${bLabel} ${pct(1 - a)}`}>
        {a > 0 && <div className="h-full rounded-l" style={{ width: `${a * 100}%`, background: "var(--series-1)" }} />}
        {a < 1 && <div className="h-full rounded-r" style={{ width: `${(1 - a) * 100}%`, background: "var(--grid)" }} />}
      </div>
      <div className="mt-1 flex justify-between text-sm" style={{ color: "var(--muted)" }}>
        <span>
          {aLabel}: <strong style={{ color: "var(--text)" }}>{pct(a)}</strong>
        </span>
        <span>
          {bLabel}: {pct(1 - a)}
        </span>
      </div>
    </div>
  );
}

/** Horizontale Balken für wenige Werte (eine Farbe = Größe). */
export function Bars({ rows }: { rows: { label: string; value: number | null; text: string }[] }) {
  return (
    <dl className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[7rem_1fr_4rem] items-center gap-2">
          <dt className="text-sm">{r.label}</dt>
          <dd className="h-4 rounded" style={{ background: "var(--grid)" }} aria-hidden="true">
            {r.value !== null && <div className="h-full rounded" style={{ width: `${Math.max(0, Math.min(1, r.value)) * 100}%`, background: "var(--series-1)" }} />}
          </dd>
          <dd className="text-right text-sm tabular-nums">{r.text}</dd>
        </div>
      ))}
    </dl>
  );
}
