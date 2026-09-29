"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bars } from "@/components/charts/Charts";
import { Alert, Button, Card, StepHeading } from "@/components/ui";
import { CATEGORY_LABELS } from "@/content/categories";
import { groupStats, type GroupStats } from "@/engine/classStats";
import type { Category } from "@/engine/types";
import { de } from "@/i18n/de";
import { ApiError } from "@/lib/arenaClient";
import { classAction, deleteClass, getClass } from "@/lib/teacherClient";
import type { ClassOverview, GroupResult } from "@/server/classes";

const t = de.teacher;
const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)} %`);
const num = (v: number | null, d = 1) => (v === null ? "–" : v.toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d }));

export type OkGroup = Extract<GroupResult, { status: "ok" }> & { stats: GroupStats };

export function okGroups(o: ClassOverview): OkGroup[] {
  return (o.results ?? []).filter((r): r is Extract<GroupResult, { status: "ok" }> => r.status === "ok").map((r) => ({ ...r, stats: groupStats(r) }));
}

function Results({ overview }: { overview: ClassOverview }) {
  if (!overview.results) return <Alert>{t.resultsPending}</Alert>;
  const ok = okGroups(overview);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">{t.resultsHeading}</h2>
      {ok.length > 0 && (
        <Card>
          <h3 className="mb-2 font-semibold">{t.compareHeading}</h3>
          <Bars
            rows={[...ok]
              .sort((a, b) => a.durationMin - b.durationMin)
              .map((g) => ({ label: `${g.label} (${g.durationMin} min)`, value: g.stats.contentCorrectMean, text: pct(g.stats.contentCorrectMean) }))}
          />
        </Card>
      )}
      {overview.results.map((r) => (
        <Card key={r.groupId} className="space-y-2">
          <h3 className="font-semibold">
            {r.label} · {r.durationMin} {de.common.minutes}
          </h3>
          {r.status === "suppressed" ? (
            <p>{t.suppressed}</p>
          ) : (
            <GroupTable g={ok.find((x) => x.groupId === r.groupId)!} />
          )}
        </Card>
      ))}
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {t.politicsNote}
      </p>
    </section>
  );
}

function GroupTable({ g }: { g: OkGroup }) {
  const s = g.stats;
  const rows: [string, string][] = [
    [t.contributions, String(s.n)],
    [t.contentCorrect, pct(s.contentCorrectMean)],
    [t.dPrime, num(s.dPrimeMean)],
    [t.videos, num(s.videosSeenMean, 0)],
    [t.prospective, pct(s.prospectiveRate)],
    [t.entropyDrop, num(s.entropyDropMean, 2)],
    [t.topics, s.topCategories.slice(0, 3).map((c) => `${CATEGORY_LABELS[c.category as Category] ?? c.category} (${c.count})`).join(", ") || "–"],
  ];
  return (
    <table className="w-full text-left text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row" className="py-1 pr-3 font-normal" style={{ color: "var(--muted)" }}>
              {k}
            </th>
            <td className="py-1 tabular-nums">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ClassDetail({ id }: { id: string }) {
  const [o, setO] = useState<ClassOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  const load = useCallback(async () => {
    try {
      setO(await getClass(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : de.arena.errors.network);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- asynchrones Laden, Polling für den Live-Fortschritt
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [load]);

  const act = async (action: "start" | "release" | "close") => {
    if (action === "close" && !window.confirm(t.closeConfirm)) return;
    try {
      await classAction(id, action);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : de.arena.errors.network);
    }
  };

  if (deleted) return <Alert tone="success">{de.report.deleted}</Alert>;
  if (error && !o) return <Alert tone="error">{error}</Alert>;
  if (!o) return <p>{de.common.loading}</p>;

  const pdf = async (kind: "results" | "worksheet") => {
    const { downloadResultsPdf, downloadWorksheetPdf } = await import("./pdf");
    if (kind === "results") await downloadResultsPdf(o, okGroups(o));
    else await downloadWorksheetPdf(o.title);
  };

  return (
    <div className="space-y-6">
      <Link href="/lehrkraft" className="text-sm underline">
        ← {t.listHeading}
      </Link>
      <StepHeading>{o.title}</StepHeading>
      {error && <Alert tone="error">{error}</Alert>}
      <Card className="space-y-2 text-center">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {t.codeHeading}
        </p>
        <p className="font-mono text-5xl font-bold tracking-[0.3em]">{o.joinCode}</p>
        <p className="text-sm">{t.codeHint}</p>
        <Link href={`/lehrkraft/klasse/${id}/beamer`} className="inline-block underline">
          {t.beamer}
        </Link>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">
            {t.participants}: {o.participants.length}
          </h2>
          {/* scrollbare Liste per Tastatur erreichbar (WCAG 2.1.1) */}
          <ul className="max-h-48 overflow-auto text-sm" tabIndex={0} aria-label={t.participants}>
            {o.participants.map((p) => (
              <li key={p.pseudonym + p.groupId}>
                {p.pseudonym} · {o.groups.find((g) => g.id === p.groupId)?.label}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">{t.progressHeading}</h2>
          <ul className="text-sm">
            {Object.entries(t.progressLabels).map(([k, label]) => (
              <li key={k}>
                {label}: {o.progress[k] ?? 0}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {o.state !== "closed" && (
        <div className="flex flex-wrap gap-3">
          {o.state === "open" && <Button onClick={() => act("start")}>{t.start}</Button>}
          {o.reportsReleasedAt ? <Alert tone="success">{t.released}</Alert> : <Button variant="secondary" onClick={() => act("release")}>{t.release}</Button>}
          <Button variant="secondary" onClick={() => act("close")}>
            {t.close}
          </Button>
        </div>
      )}

      <Results overview={o} />

      <div className="flex flex-wrap gap-3">
        {o.results && <Button variant="secondary" onClick={() => pdf("results")}>{t.pdfResults}</Button>}
        <Button variant="secondary" onClick={() => pdf("worksheet")}>
          {t.pdfWorksheet}
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            if (!window.confirm(t.deleteConfirm)) return;
            await deleteClass(id);
            setDeleted(true);
          }}
        >
          {t.deleteClass}
        </Button>
      </div>
    </div>
  );
}
