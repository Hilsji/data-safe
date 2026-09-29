/**
 * Arena-Session: Anmelden → Upload in Teilen → Job für den Worker → verschlüsseltes Ergebnis abrufen → löschen.
 * Reine Logik ohne Next.js, damit sie direkt testbar ist. Die Route Handler in src/app/api sind dünne Hüllen.
 */
import { randomUUID } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { DURATIONS, SOURCE_APPS } from "@/engine/types";
import type { ServerConfig } from "./config";
import type { ArenaSessionDoc, Store } from "./store";

export class ArenaError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const ACCEPTED_MIME = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"] as const;

const b64Key = z
  .string()
  .regex(/^[A-Za-z0-9+/]{43}=$/, "öffentlicher Schlüssel muss 32 Byte (base64) sein");

export const encryptedBlobSchema = z
  .object({
    schemaVersion: z.literal(1),
    ephemeralPublicKey: b64Key,
    iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
    ciphertext: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(64_000),
  })
  .strict();

export const registerSchema = z
  .object({
    retrievalId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{16}$/),
    publicKey: b64Key,
    durationMin: z.union(DURATIONS.map((d) => z.literal(d)) as [z.ZodLiteral<15>, z.ZodLiteral<30>, z.ZodLiteral<45>]),
    app: z.enum(SOURCE_APPS),
    ageBand: z.enum(["u14", "14-15", "16+"]),
    consents: z
      .object({ analysis: z.literal(true), politicsSpectrum: z.boolean() })
      .strict(),
    classCode: z
      .string()
      .regex(/^[0-9A-HJKMNP-TV-Z]{6}$/)
      .nullable(),
    /** Baseline-Ergebnis + Merkwort, mit dem eigenen öffentlichen Schlüssel verschlüsselt (Server kann es nicht lesen) */
    clientState: encryptedBlobSchema.nullable(),
  })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;

export const uploadInitSchema = z
  .object({
    /** null = Streaming (Laptop-Aufnahme): Größe steht erst am Ende fest → completeUpload */
    size: z.number().int().positive().nullable(),
    mimeType: z.enum(ACCEPTED_MIME),
    /** Ende der Aufnahme laut Datei (lastModified) – Basis für das Behaltensintervall */
    recordingEndedAt: z.iso.datetime(),
  })
  .strict();

export interface ArenaDeps {
  store: Store;
  config: ServerConfig;
  now?: () => Date;
}

const DAY_MS = 24 * 3600 * 1000;

export async function registerArena(deps: ArenaDeps, raw: unknown): Promise<void> {
  const input = registerSchema.parse(raw);
  if (input.ageBand === "u14") {
    throw new ArenaError(403, "age", "Der Scroll-Test ist ab 14 Jahren. Module 1 und 2 stehen dir offen.");
  }
  let classSessionId: string | null = null;
  let guardianConfirmed = false;
  if (input.classCode) {
    const cls = await deps.store.getClassByCode(input.classCode);
    if (!cls || cls.state === "closed") throw new ArenaError(404, "class", "Klassen-Code nicht gefunden.");
    classSessionId = cls._id;
    guardianConfirmed = cls.guardianConsentConfirmed;
  }
  if (input.ageBand === "14-15" && !guardianConfirmed) {
    throw new ArenaError(
      403,
      "guardian",
      "Unter 16 brauchst du die Einwilligung deiner Sorgeberechtigten. Das läuft über deine Schule: Tritt mit dem Klassen-Code bei.",
    );
  }
  const now = (deps.now ?? (() => new Date()))();
  const doc: ArenaSessionDoc = {
    _id: input.retrievalId,
    publicKey: input.publicKey,
    durationMin: input.durationMin,
    app: input.app,
    ageBand: input.ageBand,
    consents: { analysis: true, politicsSpectrum: input.consents.politicsSpectrum, guardianConfirmed },
    classSessionId,
    status: "registered",
    upload: null,
    recordingEndedAt: null,
    quizUnlockAt: null,
    progress: 0,
    failureReason: null,
    result: null,
    clientState: input.clientState,
    createdAt: now,
    expiresAt: new Date(now.getTime() + deps.config.resultTtlDays * DAY_MS),
  };
  if ((await deps.store.insertArena(doc)) === "exists") {
    throw new ArenaError(409, "exists", "Diese ID ist bereits angemeldet.");
  }
}

async function requireArena(deps: ArenaDeps, id: string): Promise<ArenaSessionDoc> {
  const doc = await deps.store.getArena(id);
  if (!doc) throw new ArenaError(404, "not_found", "Keine Session zu dieser ID (abgelaufen oder gelöscht).");
  return doc;
}

export async function initUpload(deps: ArenaDeps, id: string, raw: unknown) {
  const input = uploadInitSchema.parse(raw);
  const doc = await requireArena(deps, id);
  if (doc.status !== "registered" && doc.status !== "uploading") {
    throw new ArenaError(409, "state", "Für diese Session wurde bereits vollständig hochgeladen.");
  }
  if (input.size !== null && input.size > deps.config.maxUploadBytes) {
    throw new ArenaError(413, "too_large", "Die Aufnahme ist zu groß.", { maxBytes: deps.config.maxUploadBytes });
  }
  if (doc.upload && input.size !== null && doc.upload.size === input.size) {
    return { offset: doc.upload.received, size: doc.upload.size, chunkSize: deps.config.maxChunkBytes };
  }
  if (doc.upload) await rm(doc.upload.path, { force: true });
  await mkdir(deps.config.uploadDir, { recursive: true, mode: 0o700 });
  // Dateiname ohne Bezug zur retrievalId
  const filePath = path.join(deps.config.uploadDir, `${randomUUID()}.upload`);
  const fh = await open(filePath, "w", 0o600);
  await fh.close();
  await deps.store.updateArena(id, {
    status: "uploading",
    upload: { size: input.size, received: 0, mimeType: input.mimeType, path: filePath },
    recordingEndedAt: new Date(input.recordingEndedAt),
  });
  return { offset: 0, size: input.size, chunkSize: deps.config.maxChunkBytes };
}

export async function uploadStatus(deps: ArenaDeps, id: string) {
  const doc = await requireArena(deps, id);
  return { offset: doc.upload?.received ?? 0, size: doc.upload?.size ?? null, status: doc.status };
}

const locks = new Set<string>();

export async function appendChunk(deps: ArenaDeps, id: string, offset: number, chunk: Uint8Array) {
  if (locks.has(id)) throw new ArenaError(409, "busy", "Es wird gerade schon ein Teil hochgeladen.");
  locks.add(id);
  try {
    const doc = await requireArena(deps, id);
    if (doc.status !== "uploading" || !doc.upload) throw new ArenaError(409, "state", "Upload wurde nicht gestartet.");
    const up = doc.upload;
    if (offset !== up.received) {
      throw new ArenaError(409, "offset", "Falscher Offset – bitte ab dem gemeldeten Stand fortsetzen.", { offset: up.received });
    }
    if (chunk.byteLength === 0 || chunk.byteLength > deps.config.maxChunkBytes) {
      throw new ArenaError(413, "chunk", "Ungültige Teilgröße.", { chunkSize: deps.config.maxChunkBytes });
    }
    const limit = up.size ?? deps.config.maxUploadBytes;
    if (up.received + chunk.byteLength > limit) throw new ArenaError(413, "overflow", "Mehr Daten als angekündigt bzw. erlaubt.");

    const fh = await open(up.path, "r+");
    try {
      await fh.write(chunk, 0, chunk.byteLength, offset);
    } finally {
      await fh.close();
    }
    const received = up.received + chunk.byteLength;
    const done = up.size !== null && received === up.size;
    await deps.store.updateArena(id, { upload: { ...up, received } });
    if (done) await finalize(deps, { ...doc, upload: { ...up, received } });
    return { offset: received, complete: done };
  } finally {
    locks.delete(id);
  }
}

async function finalize(deps: ArenaDeps, doc: ArenaSessionDoc & { upload: NonNullable<ArenaSessionDoc["upload"]> }) {
  const now = (deps.now ?? (() => new Date()))();
  await deps.store.updateArena(doc._id, {
    status: "queued",
    upload: { ...doc.upload, size: doc.upload.received },
    quizUnlockAt: await computeUnlock(deps, doc),
  });
  await deps.store.insertJob({
    _id: randomUUID(),
    arenaSessionId: doc._id,
    uploadPath: doc.upload.path,
    state: "queued",
    attempts: 0,
    createdAt: now,
    expiresAt: new Date(now.getTime() + DAY_MS),
  });
}

/** Streaming-Upload abschließen (Laptop-Aufnahme). recordingEndedAt = jetzt. */
export async function completeUpload(deps: ArenaDeps, id: string) {
  const doc = await requireArena(deps, id);
  if (doc.status !== "uploading" || !doc.upload) throw new ArenaError(409, "state", "Kein laufender Upload.");
  if (doc.upload.size !== null) throw new ArenaError(409, "state", "Upload mit fester Größe schließt automatisch ab.");
  if (doc.upload.received === 0) throw new ArenaError(400, "empty", "Die Aufnahme ist leer.");
  const now = (deps.now ?? (() => new Date()))();
  await finalize(deps, { ...doc, recordingEndedAt: now, upload: doc.upload });
  return { offset: doc.upload.received, complete: true };
}

async function computeUnlock(deps: ArenaDeps, doc: ArenaSessionDoc): Promise<Date> {
  const end = doc.recordingEndedAt ?? (deps.now ?? (() => new Date()))();
  let minutes = deps.config.defaultRetentionMin;
  if (doc.classSessionId) {
    const cls = await deps.store.getClass(doc.classSessionId);
    if (cls?.retentionMin) minutes = cls.retentionMin;
  }
  return new Date(end.getTime() + minutes * 60_000);
}

export interface PublicStatus {
  status: ArenaSessionDoc["status"];
  progress: number;
  durationMin: number;
  quizUnlockAt: string | null;
  /** Bericht nur, wenn fertig UND Behaltensintervall bzw. Freigabe der Lehrkraft erreicht */
  result: ArenaSessionDoc["result"];
  clientState: ArenaSessionDoc["clientState"];
  failureReason: string | null;
}

export async function getStatus(deps: ArenaDeps, id: string): Promise<PublicStatus> {
  const doc = await requireArena(deps, id);
  const now = (deps.now ?? (() => new Date()))();
  let unlocked = doc.quizUnlockAt !== null && doc.quizUnlockAt <= now;
  if (doc.classSessionId) {
    const cls = await deps.store.getClass(doc.classSessionId);
    if (cls?.reportsReleasedAt) unlocked = unlocked || cls.reportsReleasedAt <= now;
  }
  return {
    status: doc.status,
    progress: doc.progress,
    durationMin: doc.durationMin,
    quizUnlockAt: doc.quizUnlockAt?.toISOString() ?? null,
    result: doc.status === "ready" && unlocked ? doc.result : null,
    clientState: doc.clientState,
    failureReason: doc.failureReason,
  };
}

export async function deleteArena(deps: ArenaDeps, id: string): Promise<void> {
  const doc = await deps.store.getArena(id);
  if (!doc) return;
  if (doc.upload) await rm(doc.upload.path, { force: true });
  await deps.store.deleteJobsForArena(id);
  await deps.store.deleteArena(id);
}

/** Verschlüsselten Client-Zustand ersetzen (z. B. Ergebnis der Merkwort-Aufgabe nach dem Scrollen). */
export async function updateClientState(deps: ArenaDeps, id: string, raw: unknown): Promise<void> {
  const blob = encryptedBlobSchema.parse(raw);
  const doc = await requireArena(deps, id);
  if (doc.status !== "registered" && doc.status !== "uploading") {
    throw new ArenaError(409, "state", "Der Zustand kann nach dem Upload nicht mehr geändert werden.");
  }
  await deps.store.updateArena(id, { clientState: blob });
}
