"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABELS, SPECTRUM_PHRASES } from "@/content/categories";
import { buildBubbleProfile } from "@/engine/engagement";
import { buildPoliticsProfile } from "@/engine/politicsProfile";
import type { QuizScore } from "@/engine/quizScoring";
import type { AnalysisResult } from "@/engine/types";
import { de, fmt } from "@/i18n/de";
import { loadRounds, saveRound, type SavedRound } from "@/lib/savedRounds";
import { buildContribution } from "@/engine/aggregate";
import { ApiError, contributeToClass } from "@/lib/arenaClient";
import type { ClientState } from "@/lib/clientState";
import { Alert, Button, Card, StepHeading } from "@/components/ui";
import { Bars, LineChart, RadarChart, SplitBar } from "@/components/charts/Charts";

const t = de.report.result;
const b = de.report.bubble;
const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)} %`);

/** Ab diesem Anteil wird eine Aufklärungseinheit angeboten (Arbeitspapier Tab. 13, Stufe 2/3). Kein Schwellenwert für „Sucht“. */
const SIGNAL_MIN_SEGMENTS = 3;

export function FeedReport({
  result,
  score,
  baselineDPrime,
  quizTakenAt,
  classContribution,
  onDelete,
}: {
  result: AnalysisResult;
  score: QuizScore;
  baselineDPrime: number | null;
  /** Zeitpunkt des Quiz (ms) – Behaltensintervall = Aufnahmeende bis Quiz */
  quizTakenAt: number;
  classContribution: ClientState["classContribution"];
  onDelete: () => Promise<void>;
}) {
  const bubble = useMemo(() => buildBubbleProfile(result.segments), [result]);
  const politics = useMemo(() => buildPoliticsProfile(result), [result]);
  const [showBurst, setShowBurst] = useState(false);
  const [usual, setUsual] = useState("");
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<SavedRound[]>(() => loadRounds());
  const [contribState, setContribState] = useState<"idle" | "busy" | "done" | string>("idle");

  const videos = result.segments.length;
  const minutes = Math.round(result.meta.analyzedSec / 60);
  const hoursSince = Math.max(0, (quizTakenAt - new Date(result.meta.recordingEndedAt).getTime()) / 3_600_000);
  const content = score.content.share;

  // Radar: bis zu 8 Themen, sortiert nach Angebot (Farbe folgt der Reihe, nicht dem Rang)
  const radarCats = bubble.categories.slice(0, 8);
  const maxShare = Math.max(...radarCats.map((c) => c.servedShare), 0.0001);
  const maxEng = Math.max(...radarCats.map((c) => c.engagementIndex), 0.0001);
  const politicsShare = bubble.categories.find((c) => c.category === "politics")?.servedShare ?? 0;
  const count = (cat: string) => bubble.categories.find((c) => c.category === cat)?.served ?? 0;

  const perMinute = minutes > 0 ? videos / minutes : 0;
  const usualMin = Number(usual);
  const weekVideos = usual && usualMin > 0 ? Math.round(perMinute * usualMin * 7) : null;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <StepHeading>{t.heading}</StepHeading>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            [videos, t.videos],
            [pct(content), t.correct],
            [minutes, t.minutes],
          ].map(([v, label]) => (
            <Card key={String(label)} className="!p-3">
              <p className="text-3xl font-bold tabular-nums">{v}</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {label}
              </p>
            </Card>
          ))}
        </div>
        {content !== null && (
          <div>
            <h3 className="mb-2 font-semibold">{t.stuckVsGone}</h3>
            <SplitBar share={content} aLabel={t.stuck} bLabel={t.gone} />
          </div>
        )}
        <div>
          <h3 className="mb-2 font-semibold">{t.byThird}</h3>
          <Bars
            rows={([1, 2, 3] as const).map((th, i) => ({
              label: t.thirds[i]!,
              value: score.contentByThird[th].share,
              text: `${score.contentByThird[th].correct}/${score.contentByThird[th].total}`,
            }))}
          />
        </div>
        <div>
          <h3 className="mb-2 font-semibold">{t.gistDetail}</h3>
          <Bars
            rows={[
              { label: t.gist, value: score.contentByType.gist.share, text: `${score.contentByType.gist.correct}/${score.contentByType.gist.total}` },
              { label: t.detail, value: score.contentByType.detail.share, text: `${score.contentByType.detail.correct}/${score.contentByType.detail.total}` },
            ]}
          />
        </div>
        <Card className="space-y-2">
          <h3 className="font-semibold">{t.baselineHeading}</h3>
          <p>{score.deltaToBaseline === null ? t.baselineNone : score.deltaToBaseline >= -0.25 ? t.baselineBetter : t.baselineWorse}</p>
          <p>{score.prospectiveSuccess ? t.prospectiveYes : t.prospectiveNo}</p>
          {score.orderCorrect !== null && <p>{score.orderCorrect ? t.orderYes : t.orderNo}</p>}
        </Card>
        <Alert>
          <h3 className="mb-1 font-semibold">{t.infoHeading}</h3>
          <p>{fmt(t.infoBody, { hours: hoursSince.toFixed(1).replace(".", ",") })}</p>
        </Alert>
        <Card className="space-y-2">
          <h3 className="font-semibold">{t.extrapolateHeading}</h3>
          <label className="block">
            {t.extrapolateLabel}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={1440}
              value={usual}
              onChange={(e) => setUsual(e.target.value)}
              className="mt-1 block min-h-11 w-32 rounded-lg border px-3"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            />
          </label>
          {weekVideos !== null && (
            <p aria-live="polite">
              {fmt(t.extrapolate, { videos: weekVideos, hours: ((usualMin * 7) / 60).toFixed(1).replace(".", ",") })}
            </p>
          )}
        </Card>
        <div className="space-y-2">
          {!saved ? (
            <Button
              variant="secondary"
              onClick={() => {
                const round: SavedRound = {
                  savedAt: new Date().toISOString(),
                  durationMin: result.meta.durationMin,
                  videosSeen: videos,
                  minutesInvested: minutes,
                  contentCorrectShare: content,
                  dPrime: score.recognition?.dPrime ?? null,
                  baselineDPrime,
                };
                if (saveRound(round)) {
                  setSaved(true);
                  setHistory(loadRounds());
                }
              }}
            >
              {t.save}
            </Button>
          ) : (
            <Alert tone="success">{t.saved}</Alert>
          )}
          <h3 className="font-semibold">{t.historyHeading}</h3>
          {history.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>{t.historyEmpty}</p>
          ) : (
            <Bars
              rows={history.map((h) => ({
                label: `${new Date(h.savedAt).toLocaleDateString("de-DE")} · ${h.durationMin} min`,
                value: h.contentCorrectShare,
                text: pct(h.contentCorrectShare),
              }))}
            />
          )}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold">{b.heading}</h2>
        <p style={{ color: "var(--muted)" }}>{b.intro}</p>
        <RadarChart
          title={b.radarHeading}
          aLabel={b.served}
          bLabel={b.engaged}
          summary={radarCats.map((c) => `${CATEGORY_LABELS[c.category]}: ${pct(c.servedShare)} Anteil, Index ${c.engagementIndex.toFixed(1)}`).join("; ")}
          tableHeaders={[b.category, b.share, b.engagement]}
          tableToggle={b.tableToggle}
          axes={radarCats.map((c) => ({
            label: CATEGORY_LABELS[c.category],
            a: c.servedShare / maxShare,
            b: c.engagementIndex / maxEng,
            aText: pct(c.servedShare),
            bText: c.engagementIndex.toFixed(1).replace(".", ","),
          }))}
        />
        {bubble.entropyCurve.length >= 2 && (
          <div>
            <LineChart
              title={b.narrowingHeading}
              summary={`${b.narrowingExplain} ${t.thirds[0]}: ${pct(bubble.entropyFirstThird)}, ${t.thirds[2]}: ${pct(bubble.entropyLastThird)}.`}
              points={bubble.entropyCurve.map((p) => ({ x: p.tSec / 60, y: p.entropy }))}
              xLabel={(x) => `${Math.round(x)} min`}
              valueLabel={(y) => pct(y)}
            />
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {b.narrowingExplain}
            </p>
            <p>{bubble.entropyFirstThird - bubble.entropyLastThird > 0.1 ? b.narrowingDrop : b.narrowingStable}</p>
          </div>
        )}
        {result.meta.offFeedSec >= 60 && <p style={{ color: "var(--muted)" }}>{fmt(b.offFeed, { min: Math.round(result.meta.offFeedSec / 60) })}</p>}

        <Card className="space-y-2">
          <h3 className="font-semibold">{b.politicsHeading}</h3>
          {politics.status === "disabled" && <p>{fmt(b.politicsDisabled, { pct: Math.round(politicsShare * 100) })}</p>}
          {politics.status === "insufficient_data" && <p>{b.politicsInsufficient}</p>}
          {politics.status === "no_narrowing" && <p>{b.politicsNone}</p>}
          {politics.status === "unclear" && <p>{fmt(b.politicsUnclear, { spectrum: SPECTRUM_PHRASES[politics.candidate] })}</p>}
          {politics.status === "narrowed" && (
            <>
              <p>{fmt(b.politicsNarrowed, { spectrum: SPECTRUM_PHRASES[politics.spectrum] })}</p>
              <p className="text-sm">{b.politicsConfidence[politics.confidence]}</p>
            </>
          )}
          {politics.status !== "disabled" && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {b.politicsNote}
            </p>
          )}
        </Card>

        {(count("manosphere") >= SIGNAL_MIN_SEGMENTS || count("sexualized") >= SIGNAL_MIN_SEGMENTS) && (
          <Card className="space-y-2">
            <h3 className="font-semibold">{b.signalsHeading}</h3>
            {count("manosphere") >= SIGNAL_MIN_SEGMENTS && <p>{b.manosphere}</p>}
            {count("sexualized") >= SIGNAL_MIN_SEGMENTS && <p>{b.sexualized}</p>}
          </Card>
        )}

        <div>
          <Button onClick={() => setShowBurst(!showBurst)} aria-expanded={showBurst}>
            {b.burst}
          </Button>
          {showBurst && (
            <Card className="mt-3 space-y-2">
              <h3 className="font-semibold">{b.burstHeading}</h3>
              <ol className="list-decimal space-y-2 pl-5">
                {b.burstSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {b.burstNote}
              </p>
            </Card>
          )}
        </div>
      </section>

      {classContribution && (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">{t.contributeHeading}</h2>
          <p>{t.contributeBody}</p>
          {contribState === "done" ? (
            <Alert tone="success">{t.contributed}</Alert>
          ) : (
            <Button
              disabled={contribState === "busy"}
              onClick={async () => {
                setContribState("busy");
                try {
                  await contributeToClass(buildContribution({ token: classContribution.token, durationMin: classContribution.durationMin, score, bubble }));
                  setContribState("done");
                } catch (e) {
                  setContribState(e instanceof ApiError ? e.message : de.arena.errors.network);
                }
              }}
            >
              {t.contribute}
            </Button>
          )}
          {!["idle", "busy", "done"].includes(contribState) && <Alert tone="error">{contribState}</Alert>}
        </Card>
      )}

      <Button variant="danger" onClick={onDelete}>
        {de.report.deleteReport}
      </Button>
    </div>
  );
}
