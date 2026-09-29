"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Fact } from "@/components/Fact";
import { Button, Card } from "@/components/ui";
import { de, fmt } from "@/i18n/de";
import { FactBars, FactTimeline } from "./FactVisuals";

const t = de.story;
type CardKey = keyof typeof t.cards;

const CARDS: { key: CardKey; visual: ReactNode }[] = [
  { key: "screen", visual: <><FactBars id="D01" /><p className="mt-2"><Fact id="D01" /></p></> },
  { key: "risky", visual: <><FactBars id="D02" max={100} /><p className="mt-2"><Fact id="D02" /></p></> },
  { key: "minutes", visual: <><FactTimeline id="D06" /><p><Fact id="D06" /></p><p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{t.cards.minutes.timelineNote}</p></> },
  { key: "politics", visual: <><FactTimeline id="D10" range /><p><Fact id="D10" /></p></> },
  { key: "attention", visual: <p><Fact id="N01" /></p> },
  { key: "forget", visual: <ul className="space-y-2"><li><Fact id="D16" /></li><li><Fact id="D17" /></li></ul> },
  { key: "design", visual: <p><Fact id="EU01" /></p> },
  { key: "help", visual: <p><Fact id="N02" /></p> },
];

/** Modul 1: wischbare Karten (Scroll-Snap), zusätzlich Buttons und Pfeiltasten (WCAG 2.5.7). */
export function StoryCards() {
  const [current, setCurrent] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  // Ziel einer per Button/Taste ausgelösten Animation: Scroll-Ereignisse währenddessen ignorieren,
  // sonst setzt die laufende Animation den Zähler zurück (schnelles Doppelklicken).
  const target = useRef<number | null>(null);
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (i: number) => {
    const n = Math.max(0, Math.min(CARDS.length - 1, i));
    target.current = n;
    if (release.current) clearTimeout(release.current);
    release.current = setTimeout(() => (target.current = null), 1000);
    const el = track.current?.children[n] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setCurrent(n);
  };

  return (
    <section aria-roledescription="Karussell" aria-label={t.title} className="space-y-4">
      <p aria-live="polite" className="text-sm" style={{ color: "var(--muted)" }}>
        {fmt(t.position, { n: current + 1, total: CARDS.length })}
      </p>
      <div
        ref={track}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(current + 1);
          if (e.key === "ArrowLeft") go(current - 1);
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const idx = Math.round(el.scrollLeft / el.clientWidth);
          if (target.current !== null) {
            if (idx === target.current) target.current = null;
            return;
          }
          setCurrent(idx);
        }}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "thin" }}
      >
        {CARDS.map(({ key, visual }, i) => {
          const c = t.cards[key];
          return (
            <article
              key={key}
              aria-roledescription="Karte"
              aria-label={fmt(t.position, { n: i + 1, total: CARDS.length })}
              className="w-full shrink-0 snap-start"
            >
              <Card className="flex min-h-[28rem] flex-col gap-4">
                <h2 className="text-2xl font-bold">{c.title}</h2>
                <p>{c.body}</p>
                <div>{visual}</div>
                <p className="mt-auto rounded-lg p-3 text-sm" style={{ background: "var(--bg)" }}>
                  <span aria-hidden="true">→ </span>
                  {c.action}
                </p>
              </Card>
            </article>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => go(current - 1)} disabled={current === 0} aria-label={t.prev}>
          ←
        </Button>
        <div className="flex gap-1" aria-hidden="true">
          {CARDS.map((c, i) => (
            <span key={c.key} className="h-2 w-2 rounded-full" style={{ background: i === current ? "var(--accent)" : "var(--border)" }} />
          ))}
        </div>
        <Button variant="secondary" onClick={() => go(current + 1)} disabled={current === CARDS.length - 1} aria-label={t.next}>
          →
        </Button>
      </div>
      <Link href="/vergleich" className="inline-block underline">
        {t.toComparison}
      </Link>
    </section>
  );
}
