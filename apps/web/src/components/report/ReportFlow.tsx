"use client";

import { useState } from "react";
import { decryptJson, type EncryptedBlob } from "@/crypto/ecies";
import { identityFromDisplayId, type UniqueIdentity } from "@/crypto/uniqueId";
import { buildQuiz, type Distractor, type Quiz as QuizModel } from "@/engine/quizBuilder";
import { scoreQuiz, type QuizScore } from "@/engine/quizScoring";
import { parseAnalysisResult } from "@/engine/resultSchema";
import type { AnalysisResult } from "@/engine/types";
import { de, fmt } from "@/i18n/de";
import { ApiError, deleteAll, getStatus } from "@/lib/arenaClient";
import type { ClientState } from "@/lib/clientState";
import { Alert, Button, StepHeading } from "@/components/ui";
import { FeedReport } from "./FeedReport";
import { Quiz } from "./Quiz";

const t = de.report;
const timeFmt = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

type State =
  | { kind: "enter"; error?: string }
  | { kind: "loading" }
  | { kind: "message"; text: string; tone: "info" | "error" | "success"; retry: boolean }
  | { kind: "quiz"; identity: UniqueIdentity; result: AnalysisResult; client: ClientState | null; quiz: QuizModel }
  | { kind: "report"; identity: UniqueIdentity; result: AnalysisResult; client: ClientState | null; score: QuizScore; takenAt: number }
  | { kind: "deleted" };

async function loadDistractors(): Promise<Distractor[]> {
  try {
    const r = await fetch("/distractors/manifest.json", { cache: "force-cache" });
    return r.ok ? ((await r.json()) as Distractor[]) : [];
  } catch {
    return [];
  }
}

export function ReportFlow() {
  const [idInput, setIdInput] = useState("");
  const [identity, setIdentity] = useState<UniqueIdentity | null>(null);
  const [state, setState] = useState<State>({ kind: "enter" });

  async function fetchReport(id: UniqueIdentity) {
    setState({ kind: "loading" });
    try {
      const st = await getStatus(id.retrievalId);
      if (st.status === "registered" || st.status === "uploading") return setState({ kind: "message", text: t.uploading, tone: "info", retry: true });
      if (st.status === "queued" || st.status === "processing")
        return setState({ kind: "message", text: fmt(t.processing, { pct: Math.round(st.progress * 100) }), tone: "info", retry: true });
      if (st.status === "failed") return setState({ kind: "message", text: fmt(t.failed, { reason: st.failureReason ?? "" }), tone: "error", retry: false });
      if (!st.result) {
        return setState({ kind: "message", text: fmt(t.waiting, { time: st.quizUnlockAt ? timeFmt(st.quizUnlockAt) : "?" }), tone: "info", retry: true });
      }
      let result: AnalysisResult;
      let client: ClientState | null = null;
      try {
        result = parseAnalysisResult(await decryptJson(st.result, id.privateKey));
        if (st.clientState) client = await decryptJson<ClientState>(st.clientState as EncryptedBlob, id.privateKey);
      } catch {
        return setState({ kind: "message", text: t.decryptError, tone: "error", retry: false });
      }
      // Seed aus der ID: dasselbe Quiz auf jedem Gerät
      const seed = new DataView(id.seed.buffer, id.seed.byteOffset).getUint32(0);
      const quiz = buildQuiz(result, await loadDistractors(), seed);
      setState({ kind: "quiz", identity: id, result, client, quiz });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return setState({ kind: "message", text: t.notFound, tone: "error", retry: false });
      setState({ kind: "message", text: e instanceof ApiError ? e.message : de.arena.errors.network, tone: "error", retry: true });
    }
  }

  function submitId() {
    try {
      const id = identityFromDisplayId(idInput);
      setIdentity(id);
      void fetchReport(id);
    } catch {
      setState({ kind: "enter", error: t.invalidId });
    }
  }

  async function remove(id: UniqueIdentity) {
    await deleteAll(id.retrievalId).catch(() => {});
    setState({ kind: "deleted" });
  }

  if (state.kind === "quiz") {
    return (
      <Quiz
        quiz={state.quiz}
        onDone={(answers) => {
          const p = state.client?.prospective.result;
          const score = scoreQuiz(state.quiz, { ...answers, prospectiveSuccess: p ? p.correct : false }, state.client?.baseline?.dPrime ?? null);
          setState({ kind: "report", identity: state.identity, result: state.result, client: state.client, score, takenAt: Date.now() });
        }}
      />
    );
  }

  if (state.kind === "report") {
    return (
      <FeedReport
        result={state.result}
        score={state.score}
        baselineDPrime={state.client?.baseline?.dPrime ?? null}
        quizTakenAt={state.takenAt}
        onDelete={() => remove(state.identity)}
      />
    );
  }

  return (
    <section className="space-y-5">
      <StepHeading>{t.title}</StepHeading>
      {state.kind === "deleted" ? (
        <Alert tone="success">{t.deleted}</Alert>
      ) : (
        <>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submitId();
            }}
          >
            <label className="block">
              <span className="mb-1 block font-semibold">{t.enterId}</span>
              <input
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby="id-hint"
                className="min-h-11 w-full rounded-lg border px-3 font-mono text-lg"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              />
              <span id="id-hint" className="text-sm" style={{ color: "var(--muted)" }}>
                {t.idHint}
              </span>
            </label>
            <Button type="submit" disabled={state.kind === "loading" || idInput.trim().length < 20}>
              {state.kind === "loading" ? de.common.loading : t.fetch}
            </Button>
          </form>
          {state.kind === "enter" && state.error && <Alert tone="error">{state.error}</Alert>}
          {state.kind === "message" && (
            <div className="space-y-3">
              <Alert tone={state.tone}>{state.text}</Alert>
              {state.retry && identity && (
                <Button variant="secondary" onClick={() => fetchReport(identity)}>
                  {t.refresh}
                </Button>
              )}
              {identity && (
                <Button variant="danger" onClick={() => remove(identity)}>
                  {t.deleteReport}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
