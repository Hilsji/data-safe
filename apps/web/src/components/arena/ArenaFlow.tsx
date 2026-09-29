"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createIdentity, deriveIdentity, type UniqueIdentity } from "@/crypto/uniqueId";
import { fromB64, toB64 } from "@/crypto/ecies";
import { DURATIONS, SOURCE_APPS, type DurationMin, type SourceApp } from "@/engine/types";
import type { SdtResult } from "@/engine/sdt";
import { de, fmt } from "@/i18n/de";
import { ApiError, getStatus, register, saveClientState, uploadFile } from "@/lib/arenaClient";
import { INTENTION_WORDS_DE, normalizeAnswer, type ClientState } from "@/lib/clientState";
import { Alert, Button, Card, Check, Choice, Progress, StepHeading } from "@/components/ui";
import { Baseline } from "./Baseline";
import { canRecordInBrowser, DesktopRecorder } from "./DesktopRecorder";

const t = de.arena;
const STORAGE_KEY = "guide-me:arena-flow";

type AgeBand = "u14" | "14-15" | "16+";
type Platform = "ios" | "android" | "desktop";

interface FlowState {
  step: number;
  ageBand: AgeBand | null;
  consentAnalysis: boolean;
  consentPolitics: boolean;
  classCode: string;
  /** base64 – nur in sessionStorage dieses Tabs, gelöscht nach dem Upload */
  seed: string | null;
  idConfirmed: boolean;
  baselineSeed: number;
  baseline: SdtResult | null;
  durationMin: DurationMin | null;
  app: SourceApp | null;
  intentionWord: string;
  intentionConfirmed: boolean;
  registered: boolean;
  leftAt: number | null;
  /** nach der Rückkehr: noch keine Aktion → erste Aktion zählt für die Merkaufgabe */
  awaitingFirstAction: boolean;
  starFirst: boolean | null;
  starAnswer: string | null;
  uploaded: boolean;
  quizUnlockAt: string | null;
}

const APP_URLS: Record<SourceApp, string | null> = {
  tiktok: "https://www.tiktok.com/",
  instagram_reels: "https://www.instagram.com/reels/",
  youtube_shorts: "https://www.youtube.com/shorts",
  snapchat_spotlight: "https://www.snapchat.com/spotlight",
  other: null,
};

function initialState(): FlowState {
  const rnd = new Uint32Array(2);
  crypto.getRandomValues(rnd);
  return {
    step: 0,
    ageBand: null,
    consentAnalysis: false,
    consentPolitics: false,
    classCode: "",
    seed: null,
    idConfirmed: false,
    baselineSeed: rnd[0]!,
    baseline: null,
    durationMin: null,
    app: null,
    intentionWord: INTENTION_WORDS_DE[rnd[1]! % INTENTION_WORDS_DE.length]!,
    intentionConfirmed: false,
    registered: false,
    leftAt: null,
    awaitingFirstAction: false,
    starFirst: null,
    starAnswer: null,
    uploaded: false,
    quizUnlockAt: null,
  };
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const timeFmt = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

export function ArenaFlow() {
  const [s, setS] = useState<FlowState | null>(() => {
    // Zustand laden (übersteht Neuladen, wenn der Browser den Tab im Hintergrund beendet)
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as FlowState;
    } catch {
      /* ohne Speicher weiter */
    }
    return initialState();
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!s) return;
    try {
      if (s.uploaded) sessionStorage.removeItem(STORAGE_KEY);
      else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* ignorieren */
    }
  }, [s]);

  const update = useCallback((patch: Partial<FlowState>) => setS((prev) => (prev ? { ...prev, ...patch } : prev)), []);
  const identity: UniqueIdentity | null = s?.seed ? deriveIdentity(fromB64(s.seed)) : null;

  // Rückkehr aus der Kurzvideo-App erkennen (für die Merkaufgabe)
  useEffect(() => {
    const onVis = () => {
      setS((prev) => {
        if (!prev || prev.step !== 5) return prev;
        if (document.visibilityState === "hidden") return { ...prev, leftAt: Date.now() };
        if (prev.leftAt && Date.now() - prev.leftAt > 60_000 && prev.starFirst === null) {
          return { ...prev, awaitingFirstAction: true };
        }
        return prev;
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Erste Aktion nach der Rückkehr: war es der Stern?
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const isStar = (e.target as HTMLElement).closest("[data-star]") !== null;
      setS((prev) => (prev?.awaitingFirstAction ? { ...prev, awaitingFirstAction: false, starFirst: isStar } : prev));
    };
    el.addEventListener("click", onClick, true);
    return () => el.removeEventListener("click", onClick, true);
  });

  if (!s) return <p>{de.common.loading}</p>;

  const clientState = (): ClientState => ({
    v: 1,
    createdAt: new Date().toISOString(),
    durationMin: s.durationMin!,
    app: s.app!,
    baseline: s.baseline ? { dPrime: s.baseline.dPrime, hitRate: s.baseline.hitRate, falseAlarmRate: s.baseline.falseAlarmRate } : null,
    prospective: {
      kind: "word_at_end",
      word: s.intentionWord,
      result:
        s.starAnswer === null
          ? null
          : { tappedStarFirst: s.starFirst === true, answer: s.starAnswer, correct: normalizeAnswer(s.starAnswer) === normalizeAnswer(s.intentionWord) },
    },
  });

  async function doRegister() {
    if (!identity || !s || !s.durationMin || !s.app || s.ageBand === "u14" || !s.ageBand) return;
    setBusy(true);
    setError(null);
    try {
      await register({
        identity,
        durationMin: s.durationMin,
        app: s.app,
        ageBand: s.ageBand,
        politicsSpectrum: s.consentPolitics,
        classCode: s.classCode.trim() ? s.classCode.trim().toUpperCase() : null,
        clientState: clientState(),
      });
      update({ registered: true, step: 5 });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.network);
    } finally {
      setBusy(false);
    }
  }

  const star =
    s.step >= 5 && s.registered && s.starAnswer === null ? (
      <StarButton
        onSave={async (answer) => {
          update({ starAnswer: answer });
          if (identity) {
            const next = { ...clientState(), prospective: { ...clientState().prospective } };
            next.prospective.result = { tappedStarFirst: s.starFirst === true, answer, correct: normalizeAnswer(answer) === normalizeAnswer(s.intentionWord) };
            await saveClientState(identity, next).catch(() => {});
          }
        }}
      />
    ) : null;

  return (
    <div ref={containerRef} className="relative">
      {star && <div className="absolute right-0 top-0">{star}</div>}
      <Progress steps={t.steps} current={s.step} />
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {s.step === 0 && (
        <section className="space-y-6">
          <StepHeading>{t.intro.heading}</StepHeading>
          <p>{t.intro.body}</p>
          <Choice
            legend={t.intro.ageQuestion}
            name="age"
            value={s.ageBand}
            onChange={(v) => update({ ageBand: v })}
            options={(["u14", "14-15", "16+"] as const).map((v) => ({ value: v, label: t.intro.ageOptions[v] }))}
          />
          {s.ageBand === "u14" ? (
            <Alert>
              <p className="mb-3">{t.intro.under14}</p>
              <Link href="/wissen" className="underline">
                {t.intro.toModules}
              </Link>
            </Alert>
          ) : (
            <Button disabled={!s.ageBand} onClick={() => update({ step: 1 })}>
              {de.common.next}
            </Button>
          )}
        </section>
      )}

      {s.step === 1 && (
        <section className="space-y-5">
          <StepHeading>{t.consent.heading}</StepHeading>
          <ul className="list-disc space-y-2 pl-5">
            {t.consent.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <Check label={t.consent.analysisLabel} checked={s.consentAnalysis} onChange={(v) => update({ consentAnalysis: v })} />
          <Card>
            <h3 className="mb-2 font-semibold">{t.consent.politicsHeading}</h3>
            <p className="mb-2 text-sm">{t.consent.politicsBody}</p>
            <Check label={t.consent.politicsLabel} checked={s.consentPolitics} onChange={(v) => update({ consentPolitics: v })} />
          </Card>
          {s.ageBand === "14-15" && <Alert>{t.consent.guardianHint}</Alert>}
          <label className="block">
            <span className="mb-1 block font-semibold">{s.ageBand === "14-15" ? t.consent.classCodeLabel : t.consent.classCodeOptional}</span>
            <input
              value={s.classCode}
              onChange={(e) => update({ classCode: e.target.value.toUpperCase().slice(0, 6) })}
              autoComplete="off"
              autoCapitalize="characters"
              inputMode="text"
              className="min-h-11 w-40 rounded-lg border px-3 font-mono text-lg tracking-widest"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            />
          </label>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => update({ step: 0 })}>
              {de.common.back}
            </Button>
            <Button
              disabled={!s.consentAnalysis || (s.ageBand === "14-15" && s.classCode.length !== 6)}
              onClick={() => update({ step: 2, seed: s.seed ?? toB64(createIdentity().seed) })}
            >
              {de.common.next}
            </Button>
          </div>
        </section>
      )}

      {s.step === 2 && identity && (
        <section className="space-y-5">
          <StepHeading>{t.id.heading}</StepHeading>
          <p>{t.id.body}</p>
          <Card>
            <p className="break-all text-center font-mono text-2xl tracking-wider" aria-label={identity.displayId.split("").join(" ")}>
              {identity.displayId}
            </p>
          </Card>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {t.id.how}
          </p>
          <CopyButton text={identity.displayId} />
          <Check label={t.id.confirm} checked={s.idConfirmed} onChange={(v) => update({ idConfirmed: v })} />
          <Button disabled={!s.idConfirmed} onClick={() => update({ step: 3 })}>
            {de.common.next}
          </Button>
        </section>
      )}

      {s.step === 3 && (
        <Baseline
          seed={s.baselineSeed}
          onDone={(r) => {
            update({ baseline: r });
            update({ step: 4 });
          }}
        />
      )}

      {s.step === 4 && (
        <section className="space-y-6">
          <StepHeading>{t.setup.heading}</StepHeading>
          <Alert tone="success">{t.baseline.done}</Alert>
          <Choice
            legend={t.setup.durationLabel}
            name="duration"
            value={s.durationMin}
            onChange={(v) => update({ durationMin: v })}
            options={DURATIONS.map((d) => ({ value: d, label: `${d} ${de.common.minutes}` }))}
          />
          <Choice
            legend={t.setup.appLabel}
            name="app"
            value={s.app}
            onChange={(v) => update({ app: v })}
            options={SOURCE_APPS.map((a) => ({ value: a, label: t.setup.apps[a] }))}
          />
          {s.app === "other" && <Alert>{t.setup.otherAppHint}</Alert>}
          <Card>
            <h3 className="mb-2 font-semibold">{t.setup.intentionHeading}</h3>
            <p className="mb-4">{t.setup.intentionBody}</p>
            <p className="mb-4 text-center text-3xl font-bold">{s.intentionWord}</p>
            <Check label={t.setup.intentionConfirm} checked={s.intentionConfirmed} onChange={(v) => update({ intentionConfirmed: v })} />
          </Card>
          <Button disabled={!s.durationMin || !s.app || !s.intentionConfirmed || busy} onClick={doRegister}>
            {busy ? de.common.loading : de.common.next}
          </Button>
        </section>
      )}

      {s.step === 5 && identity && s.durationMin && s.app && (
        <RecordStep
          app={s.app}
          durationMin={s.durationMin}
          retrievalId={identity.retrievalId}
          onDesktopFinished={async () => {
            const st = await getStatus(identity.retrievalId).catch(() => null);
            update({ step: 6, uploaded: true, quizUnlockAt: st?.quizUnlockAt ?? null });
          }}
          onBack={() => update({ step: 6 })}
        />
      )}

      {s.step === 6 && identity && (
        <UploadStep
          identity={identity}
          uploaded={s.uploaded}
          quizUnlockAt={s.quizUnlockAt}
          onUploaded={(unlock) => update({ uploaded: true, quizUnlockAt: unlock })}
        />
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          /* Kopieren nicht erlaubt – ID steht sichtbar da */
        }
      }}
    >
      {copied ? t.id.copied : t.id.copy}
    </Button>
  );
}

function StarButton({ onSave }: { onSave: (answer: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  if (saved) return <span className="sr-only">{t.star.thanks}</span>;
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        data-star
        type="button"
        aria-label={t.star.label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-11 w-11 items-center justify-center rounded-full border text-xl"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        ☆
      </button>
      {open && (
        <Card className="w-64 space-y-2">
          <label className="block text-sm font-semibold">
            {t.star.prompt}
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              style={{ borderColor: "var(--border)" }}
              autoComplete="off"
            />
          </label>
          <Button
            data-star
            disabled={!value.trim()}
            onClick={async () => {
              await onSave(value);
              setSaved(true);
            }}
          >
            {t.star.save}
          </Button>
        </Card>
      )}
    </div>
  );
}

function RecordStep(props: { app: SourceApp; durationMin: DurationMin; retrievalId: string; onDesktopFinished: () => void | Promise<void>; onBack: () => void }) {
  const [platform, setPlatform] = useState<Platform>(detectPlatform);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const url = APP_URLS[props.app];
  const steps = platform === "ios" ? t.record.ios : platform === "android" ? t.record.android : t.record.desktop;
  return (
    <section className="space-y-5">
      <StepHeading>{t.record.heading}</StepHeading>
      <div role="tablist" aria-label="Gerät" className="flex flex-wrap gap-2">
        {(["ios", "android", "desktop"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={platform === p}
            onClick={() => setPlatform(p)}
            className="min-h-11 rounded-lg border px-4"
            style={{ borderColor: platform === p ? "var(--accent)" : "var(--border)", fontWeight: platform === p ? 700 : 400 }}
          >
            {t.record.platforms[p]}
          </button>
        ))}
      </div>
      <Alert>{t.record.prepare}</Alert>
      <ol className="list-decimal space-y-2 pl-5">
        {steps.map((st) => (
          <li key={st}>{st}</li>
        ))}
      </ol>
      {endsAt && <Alert tone="success">{fmt(t.record.endsAt, { time: timeFmt(endsAt) })}</Alert>}
      {platform === "desktop" ? (
        canRecordInBrowser() ? (
          <DesktopRecorder retrievalId={props.retrievalId} durationMin={props.durationMin} onFinished={props.onDesktopFinished} />
        ) : (
          <Alert tone="error">{t.record.desktopUnsupported}</Alert>
        )
      ) : (
        <div className="flex flex-wrap gap-3">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setEndsAt(new Date(Date.now() + props.durationMin * 60_000))}
              className="inline-flex min-h-11 items-center rounded-lg border-2 px-5 font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)", borderColor: "var(--accent)" }}
            >
              {t.record.openApp}
            </a>
          )}
          <Button variant="secondary" onClick={props.onBack}>
            {t.record.ready}
          </Button>
        </div>
      )}
    </section>
  );
}

function UploadStep(props: { identity: UniqueIdentity; uploaded: boolean; quizUnlockAt: string | null; onUploaded: (unlock: string | null) => void }) {
  const [pct, setPct] = useState<number | null>(null);
  const [resumed, setResumed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.type && !file.type.startsWith("video/")) {
      setError(t.upload.wrongType);
      return;
    }
    setError(null);
    try {
      await uploadFile(props.identity.retrievalId, file, (sent, total, r) => {
        setPct(Math.floor((sent / total) * 100));
        setResumed(r);
      });
      const st = await getStatus(props.identity.retrievalId);
      props.onUploaded(st.quizUnlockAt);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.network);
    }
  }

  if (props.uploaded) {
    return (
      <section className="space-y-5">
        <StepHeading>{t.upload.done}</StepHeading>
        {props.quizUnlockAt && <p>{fmt(t.upload.reportFrom, { time: timeFmt(new Date(props.quizUnlockAt)) })}</p>}
        <Card>
          <p className="text-sm">{t.upload.rememberId}</p>
          <p className="break-all font-mono text-xl">{props.identity.displayId}</p>
        </Card>
        <Link href="/wissen" className="inline-block underline">
          {t.upload.toModules}
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <StepHeading>{t.upload.heading}</StepHeading>
      <p>{t.upload.body}</p>
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border-2 px-5 font-semibold" style={{ background: "var(--accent)", color: "var(--accent-contrast)", borderColor: "var(--accent)" }}>
        {t.upload.choose}
        <input type="file" accept="video/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} disabled={pct !== null && pct < 100} />
      </label>
      {pct !== null && (
        <div>
          <progress max={100} value={pct} className="w-full" aria-label={fmt(t.upload.progress, { pct })} />
          <p aria-live="polite">{fmt(t.upload.progress, { pct })}</p>
          {resumed && <Alert>{t.upload.resumed}</Alert>}
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </section>
  );
}
