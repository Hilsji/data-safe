/**
 * Browser-Client für die Arena-API: Anmelden, fortsetzbarer Upload, Status, Löschen.
 */
import { encryptJson, toB64, type EncryptedBlob } from "@/crypto/ecies";
import type { UniqueIdentity } from "@/crypto/uniqueId";
import type { DurationMin, SourceApp } from "@/engine/types";
import type { PublicStatus } from "@/server/arena";
import type { JoinResult } from "@/server/classes";
import type { Contribution } from "@/engine/aggregate";
import type { ClientState } from "./clientState";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, String(body.error ?? "http"), String(body.message ?? res.statusText), body);
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function register(args: {
  identity: UniqueIdentity;
  durationMin: DurationMin;
  app: SourceApp;
  ageBand: "14-15" | "16+";
  politicsSpectrum: boolean;
  classCode: string | null;
  clientState: ClientState;
}): Promise<void> {
  await call("/api/arena", json("POST", {
    retrievalId: args.identity.retrievalId,
    publicKey: toB64(args.identity.publicKey),
    durationMin: args.durationMin,
    app: args.app,
    ageBand: args.ageBand,
    consents: { analysis: true, politicsSpectrum: args.politicsSpectrum },
    classCode: args.classCode,
    clientState: await encryptJson(args.clientState, args.identity.publicKey),
  }));
}

export async function saveClientState(identity: UniqueIdentity, state: ClientState): Promise<void> {
  await call(`/api/arena/${identity.retrievalId}/client-state`, json("PUT", await encryptJson(state, identity.publicKey)));
}

export function getStatus(retrievalId: string): Promise<PublicStatus & { clientState: EncryptedBlob | null }> {
  return call(`/api/arena/${retrievalId}`);
}

export function joinClass(code: string): Promise<JoinResult> {
  return call("/api/class/join", json("POST", { code }));
}

export function contributeToClass(contribution: Contribution): Promise<void> {
  return call("/api/class/contribute", json("POST", contribution));
}

export function deleteAll(retrievalId: string): Promise<void> {
  return call(`/api/arena/${retrievalId}`, { method: "DELETE" });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Datei in Teilen hochladen; setzt nach Verbindungsabbrüchen an der Server-Position fort. */
export async function uploadFile(
  retrievalId: string,
  file: File,
  onProgress: (sent: number, total: number, resumed: boolean) => void,
  signal?: AbortSignal,
): Promise<void> {
  const base = `/api/arena/${retrievalId}/upload`;
  const init = await call<{ offset: number; chunkSize: number }>(base, json("POST", {
    size: file.size,
    mimeType: file.type || "video/mp4",
    recordingEndedAt: new Date(file.lastModified || Date.now()).toISOString(),
  }));
  let offset = init.offset;
  let failures = 0;
  onProgress(offset, file.size, false);
  while (offset < file.size) {
    if (signal?.aborted) throw new DOMException("abgebrochen", "AbortError");
    const chunk = file.slice(offset, Math.min(offset + init.chunkSize, file.size));
    try {
      const r = await call<{ offset: number }>(base, { method: "PATCH", headers: { "upload-offset": String(offset) }, body: chunk, signal });
      offset = r.offset;
      failures = 0;
      onProgress(offset, file.size, false);
    } catch (e) {
      if (e instanceof ApiError && e.code === "offset" && typeof e.body.offset === "number") {
        offset = e.body.offset;
        continue;
      }
      if (e instanceof ApiError && e.status < 500 && e.status !== 409 && e.status !== 429) throw e;
      failures++;
      if (failures > 8) throw e;
      onProgress(offset, file.size, true);
      await sleep(Math.min(30_000, 1000 * 2 ** failures));
      const st = await call<{ offset: number }>(base).catch(() => ({ offset }));
      offset = st.offset;
    }
  }
}

/** Streaming-Upload für die Laptop-Aufnahme (MediaRecorder liefert Teile unbekannter Gesamtgröße). */
export class StreamUploader {
  private offset = 0;
  private queue: Blob[] = [];
  private running: Promise<void> | null = null;
  private base: string;
  constructor(retrievalId: string, private onProgress: (sent: number) => void) {
    this.base = `/api/arena/${retrievalId}/upload`;
  }
  async start(mimeType: string) {
    const r = await call<{ offset: number }>(this.base, json("POST", { size: null, mimeType, recordingEndedAt: new Date().toISOString() }));
    this.offset = r.offset;
  }
  push(blob: Blob) {
    if (blob.size === 0) return;
    this.queue.push(blob);
    this.running ??= this.drain().finally(() => (this.running = null));
  }
  private async drain() {
    while (this.queue.length) {
      const blob = this.queue[0]!;
      let failures = 0;
      for (;;) {
        try {
          const r = await call<{ offset: number }>(this.base, { method: "PATCH", headers: { "upload-offset": String(this.offset) }, body: blob });
          this.offset = r.offset;
          this.onProgress(this.offset);
          break;
        } catch (e) {
          if (++failures > 8) throw e;
          await sleep(Math.min(30_000, 1000 * 2 ** failures));
        }
      }
      this.queue.shift();
    }
  }
  async finish() {
    while (this.running) await this.running;
    await call(`${this.base}/complete`, { method: "POST" });
  }
}
