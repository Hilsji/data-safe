"use client";

import { useEffect, useRef, useState } from "react";
import { StreamUploader } from "@/lib/arenaClient";
import { de, fmt } from "@/i18n/de";
import { Alert, Button } from "@/components/ui";

const t = de.arena.record;

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((c) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) ?? "video/webm";
}

export function canRecordInBrowser(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== "undefined";
}

/**
 * Laptop-Aufnahme: getDisplayMedia + MediaRecorder, Teile alle 5 s direkt hochladen (Streaming).
 * Stoppt automatisch nach der gewählten Dauer oder wenn die Freigabe beendet wird.
 */
export function DesktopRecorder({ retrievalId, durationMin, onFinished }: { retrievalId: string; durationMin: number; onFinished: () => void | Promise<void> }) {
  const [state, setState] = useState<"idle" | "recording" | "finishing" | "error">("idle");
  const [elapsedMin, setElapsedMin] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const uploader = useRef<StreamUploader | null>(null);

  useEffect(() => {
    if (state !== "recording") return;
    const started = Date.now();
    const tick = setInterval(() => setElapsedMin(Math.floor((Date.now() - started) / 60_000)), 5_000);
    const stopAt = setTimeout(() => recorder.current?.stop(), durationMin * 60_000);
    return () => {
      clearInterval(tick);
      clearTimeout(stopAt);
    };
  }, [state, durationMin]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: true });
      const mimeType = pickMimeType();
      const up = new StreamUploader(retrievalId, () => {});
      await up.start(mimeType.split(";")[0]!);
      uploader.current = up;
      const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 });
      recorder.current = rec;
      rec.ondataavailable = (e) => up.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setState("finishing");
        try {
          await up.finish();
          await onFinished();
        } catch {
          setState("error");
          setError(de.arena.errors.network);
        }
      };
      // Freigabe über die Browser-Leiste beendet → Aufnahme sauber abschließen
      stream.getVideoTracks()[0]?.addEventListener("ended", () => rec.state !== "inactive" && rec.stop());
      rec.start(5_000);
      setState("recording");
    } catch {
      setState("error");
      setError(de.arena.errors.generic);
    }
  }

  return (
    <div className="space-y-4">
      {state === "idle" && <Button onClick={start}>{t.startDesktop}</Button>}
      {state === "recording" && (
        <>
          <Alert>{fmt(t.recordingSince, { min: elapsedMin })}</Alert>
          <Button variant="secondary" onClick={() => recorder.current?.stop()}>
            {t.stopDesktop}
          </Button>
        </>
      )}
      {state === "finishing" && <Alert>{de.common.loading}</Alert>}
      {error && (
        <>
          <Alert tone="error">{error}</Alert>
          <Button onClick={start}>{de.common.retry}</Button>
        </>
      )}
    </div>
  );
}
