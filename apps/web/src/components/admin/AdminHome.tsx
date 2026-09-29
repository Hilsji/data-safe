"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Check, StepHeading } from "@/components/ui";
import { CATEGORY_LABELS } from "@/content/categories";
import { CATEGORIES, SPECTRA, type Category, type Spectrum } from "@/engine/types";
import { de, fmt } from "@/i18n/de";
import { ApiError } from "@/lib/arenaClient";
import { me } from "@/lib/teacherClient";
import type { ModelReport } from "@/server/calibration";

const t = de.admin;
const SPECTRUM_OPTIONS: Record<Spectrum, string> = {
  left: "links",
  center_left: "Mitte-links",
  center: "Mitte",
  center_right: "Mitte-rechts",
  right: "rechts",
  unassignable: "nicht zuordenbar",
};

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, String(body.error ?? "http"), String(body.message ?? res.statusText), body);
  return body as T;
}

interface RecordingItem {
  id: string;
  title: string;
  app: string;
  modelVersion: string;
  segments: number;
  taggedByMe: number;
}

interface Tag {
  category: Category;
  spectrum?: Spectrum;
  boundaryOk: boolean;
  likeOk: boolean;
  replayOk: boolean;
}

interface RaterSegment {
  id: string;
  startSec: number;
  endSec: number;
  keyframe: string;
  detected: { liked: boolean | null; replays: number | null };
  myTag: Tag | null;
}

const selectStyle = { borderColor: "var(--border)", background: "var(--surface)" };

function SegmentTagger({ recordingId, seg, n }: { recordingId: string; seg: RaterSegment; n: number }) {
  const [tag, setTag] = useState<Tag>(seg.myTag ?? { category: "other", boundaryOk: true, likeOk: true, replayOk: true });
  const [saved, setSaved] = useState(seg.myTag !== null);
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<Tag>) => {
    setTag({ ...tag, ...patch });
    setSaved(false);
  };
  const yesNo = (v: boolean | null) => (v === null ? t.unknown : v ? de.common.yes : de.common.no);
  return (
    <Card className="grid gap-4 sm:grid-cols-[10rem_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element -- Data-URL aus der Kalibrieraufnahme */}
      <img src={seg.keyframe} alt={fmt(t.segment, { n })} className="w-40 rounded" />
      <div className="space-y-2">
        <p className="font-semibold">
          {fmt(t.segment, { n })} · {seg.startSec.toFixed(1)}–{seg.endSec.toFixed(1)} s
        </p>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {fmt(t.detected, { like: yesNo(seg.detected.liked), replays: seg.detected.replays ?? t.unknown })}
        </p>
        <label className="block text-sm">
          {t.category}
          <select value={tag.category} onChange={(e) => change({ category: e.target.value as Category })} className="mt-1 block min-h-11 w-full rounded-lg border px-2" style={selectStyle}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        {tag.category === "politics" && (
          <label className="block text-sm">
            {t.spectrum}
            <select value={tag.spectrum ?? "unassignable"} onChange={(e) => change({ spectrum: e.target.value as Spectrum })} className="mt-1 block min-h-11 w-full rounded-lg border px-2" style={selectStyle}>
              {SPECTRA.map((s) => (
                <option key={s} value={s}>
                  {SPECTRUM_OPTIONS[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        <Check label={t.boundaryOk} checked={tag.boundaryOk} onChange={(v) => change({ boundaryOk: v })} />
        <Check label={t.likeOk} checked={tag.likeOk} onChange={(v) => change({ likeOk: v })} />
        <Check label={t.replayOk} checked={tag.replayOk} onChange={(v) => change({ replayOk: v })} />
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={saved}
            onClick={async () => {
              setError(null);
              try {
                await call(`/api/admin/calibration/${recordingId}/tag`, {
                  method: "PUT",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ segmentId: seg.id, ...tag, spectrum: tag.category === "politics" ? (tag.spectrum ?? "unassignable") : undefined }),
                });
                setSaved(true);
              } catch (e) {
                setError(e instanceof ApiError ? e.message : de.arena.errors.network);
              }
            }}
          >
            {saved ? t.saved : t.save}
          </Button>
          {error && <span role="alert">{error}</span>}
        </div>
      </div>
    </Card>
  );
}

function Tagging({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<{ title: string; segments: RaterSegment[] } | null>(null);
  useEffect(() => {
    void call<{ title: string; segments: RaterSegment[] }>(`/api/admin/calibration/${id}`).then(setData);
  }, [id]);
  if (!data) return <p>{de.common.loading}</p>;
  return (
    <section className="space-y-4">
      <Button variant="secondary" onClick={onBack}>
        ← {t.back}
      </Button>
      <StepHeading>{data.title}</StepHeading>
      <p style={{ color: "var(--muted)" }}>{t.ratingHint}</p>
      {data.segments.map((s, i) => (
        <SegmentTagger key={s.id} recordingId={id} seg={s} n={i + 1} />
      ))}
    </section>
  );
}

function Report({ onChange }: { onChange: () => void }) {
  const [r, setR] = useState<ModelReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => call<ModelReport>("/api/admin/validation").then(setR), []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!r) return <p>{de.common.loading}</p>;
  const k = (v: number | null) => (v === null ? "–" : v.toFixed(2).replace(".", ","));
  const p = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)} %`);
  const rep = r.report;
  return (
    <Card className="space-y-3">
      <h2 className="text-xl font-bold">{t.reportHeading}</h2>
      {r.approval.approvedModelVersion ? <Alert tone="success">{fmt(t.approvedFor, { version: r.approval.approvedModelVersion })}</Alert> : <Alert>{t.notApproved}</Alert>}
      {rep && (
        <>
          <table className="w-full text-left text-sm">
            <tbody>
              {(
                [
                  [t.modelVersion, r.modelVersion ?? "–"],
                  [t.doubleTagged, `${rep.doubleTagged} / ${rep.segments}`],
                  [t.kappaCatHH, k(rep.category.humanHuman.kappa)],
                  [t.kappaCatHM, k(rep.category.humanModel.kappa)],
                  [t.kappaSpecHH, k(rep.spectrum.humanHuman.kappa)],
                  [t.kappaSpecHM, k(rep.spectrum.humanModel.kappa)],
                  [t.recall, Object.entries(rep.recallPerSpectrum).map(([s, v]) => `${SPECTRUM_OPTIONS[s as Spectrum]} ${p(v.recall)} (n=${v.n})`).join(" · ")],
                  [t.gaps, rep.mirrorGaps.map((g) => `${g.pair.map((s) => SPECTRUM_OPTIONS[s]).join("/")}: ${k(g.gap)}`).join(" · ")],
                  [t.signals, `Grenzen ${p(rep.signalAccuracy.boundary)} · Like ${p(rep.signalAccuracy.like)} · Wiederholung ${p(rep.signalAccuracy.replay)}`],
                ] as [string, string][]
              ).map(([a, b]) => (
                <tr key={a}>
                  <th scope="row" className="py-1 pr-3 font-normal" style={{ color: "var(--muted)" }}>
                    {a}
                  </th>
                  <td className="py-1">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rep.politicsApprovable ? (
            <Alert tone="success">{t.approvable}</Alert>
          ) : (
            <Alert>
              <p>{t.notApprovable}</p>
              <ul className="list-disc pl-5 text-sm">
                {rep.reasons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Alert>
          )}
        </>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={!rep?.politicsApprovable}
          onClick={async () => {
            setError(null);
            try {
              await call("/api/admin/validation/approve", { method: "POST" });
              await load();
              onChange();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : de.arena.errors.network);
            }
          }}
        >
          {t.approve}
        </Button>
        {r.approval.approvedModelVersion && (
          <Button
            variant="danger"
            onClick={async () => {
              await call("/api/admin/validation/revoke", { method: "POST" });
              await load();
            }}
          >
            {t.revoke}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Upload({ onDone }: { onDone: () => void }) {
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  return (
    <Card className="space-y-2">
      <h2 className="text-xl font-bold">{t.uploadHeading}</h2>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {t.uploadHint}
      </p>
      <input
        type="file"
        accept="application/json"
        aria-label={t.uploadHeading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            await call("/api/admin/calibration", { method: "POST", headers: { "content-type": "application/json" }, body: await file.text() });
            setMsg({ text: t.uploadDone, tone: "success" });
            onDone();
          } catch (err) {
            setMsg({ text: err instanceof ApiError ? err.message : de.arena.errors.generic, tone: "error" });
          }
        }}
      />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </Card>
  );
}

export function AdminHome() {
  const [roles, setRoles] = useState<string[] | null>(null);
  const [recs, setRecs] = useState<RecordingItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    const r = await me().catch(() => ({ roles: [] as string[] }));
    setRoles(r.roles);
    if (r.roles.includes("rater")) setRecs(await call<RecordingItem[]>("/api/admin/calibration").catch(() => []));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- asynchrones Laden
    void refresh();
  }, [refresh, version]);

  if (roles === null) return <p>{de.common.loading}</p>;
  if (!roles.includes("rater")) {
    return (
      <Alert>
        <p>{t.notAllowed}</p>
        <Link href="/lehrkraft" className="underline">
          {t.toLogin}
        </Link>
      </Alert>
    );
  }
  if (open) return <Tagging id={open} onBack={() => { setOpen(null); setVersion((v) => v + 1); }} />;

  return (
    <div className="space-y-6">
      <StepHeading>{t.title}</StepHeading>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">{t.ratingHeading}</h2>
        <p style={{ color: "var(--muted)" }}>{t.ratingHint}</p>
        {recs.length === 0 ? (
          <p>{t.noRecordings}</p>
        ) : (
          <ul className="space-y-2">
            {recs.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-wrap items-center justify-between gap-2 !py-3">
                  <span className="font-semibold">{r.title}</span>
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {r.app} · {r.modelVersion} · {fmt(t.progress, { done: r.taggedByMe, total: r.segments })}
                  </span>
                  <Button variant="secondary" onClick={() => setOpen(r.id)}>
                    {t.open}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      {roles.includes("admin") && (
        <>
          <Upload onDone={() => setVersion((v) => v + 1)} />
          <Report key={version} onChange={() => setVersion((v) => v + 1)} />
        </>
      )}
    </div>
  );
}
