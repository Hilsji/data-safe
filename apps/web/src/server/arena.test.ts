import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { appendChunk, ArenaError, completeUpload, deleteArena, getStatus, initUpload, registerArena, uploadStatus, type ArenaDeps } from "./arena";
import { MemoryStore, type ClassSessionDoc } from "./store";
import type { ServerConfig } from "./config";
import { createIdentity } from "@/crypto/uniqueId";
import { toB64 } from "@/crypto/ecies";

function classDoc(p: Pick<ClassSessionDoc, "_id" | "joinCode" | "guardianConsentConfirmed" | "retentionMin" | "reportsReleasedAt" | "state" | "expiresAt">): ClassSessionDoc {
  return { teacherId: "t", title: "Test", groups: [{ id: "A", label: "A", durationMin: 15 }], startedAt: null, joinCount: 0, createdAt: new Date(), ...p };
}

let dir: string;
let store: MemoryStore;
let deps: ArenaDeps;
let now: Date;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "guide-upload-"));
  store = new MemoryStore();
  now = new Date("2026-09-30T08:00:00Z");
  const config: ServerConfig = {
    mongoUri: null,
    mongoDb: "test",
    uploadDir: dir,
    maxUploadBytes: 1000,
    maxChunkBytes: 100,
    resultTtlDays: 7,
    defaultRetentionMin: 45,
  };
  deps = { store, config, now: () => now };
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function registration(overrides: Record<string, unknown> = {}) {
  const id = createIdentity();
  return {
    id,
    body: {
      retrievalId: id.retrievalId,
      publicKey: toB64(id.publicKey),
      durationMin: 15,
      app: "tiktok",
      ageBand: "16+",
      consents: { analysis: true, politicsSpectrum: false },
      classCode: null,
      clientState: null,
      ...overrides,
    },
  };
}

async function expectArenaError(p: Promise<unknown>, status: number, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof ArenaError && e.status === status && e.code === code);
}

describe("registerArena", () => {
  it("legt eine Session ohne personenbezogene Angaben an", async () => {
    const { id, body } = registration();
    await registerArena(deps, body);
    const doc = store.arenas.get(id.retrievalId)!;
    expect(doc.status).toBe("registered");
    expect(doc.expiresAt.getTime() - now.getTime()).toBe(7 * 24 * 3600 * 1000);
    expect(JSON.stringify(doc)).not.toContain(id.displayId);
  });

  it("lehnt unter 14 ab", async () => {
    await expectArenaError(registerArena(deps, registration({ ageBand: "u14" }).body), 403, "age");
  });

  it("verlangt unter 16 eine Klasse mit bestätigter Einwilligung der Sorgeberechtigten", async () => {
    await expectArenaError(registerArena(deps, registration({ ageBand: "14-15" }).body), 403, "guardian");
    store.classes.set("c1", classDoc({ _id: "c1", joinCode: "ABC123", guardianConsentConfirmed: false, retentionMin: null, reportsReleasedAt: null, state: "open", expiresAt: now }));
    await expectArenaError(registerArena(deps, registration({ ageBand: "14-15", classCode: "ABC123" }).body), 403, "guardian");
    store.classes.set("c2", classDoc({ _id: "c2", joinCode: "XYZ789", guardianConsentConfirmed: true, retentionMin: null, reportsReleasedAt: null, state: "open", expiresAt: now }));
    await registerArena(deps, registration({ ageBand: "14-15", classCode: "XYZ789" }).body);
  });

  it("weist Zusatzfelder ab (z. B. Namen)", async () => {
    await expect(registerArena(deps, { ...registration().body, name: "Max" })).rejects.toThrow();
  });

  it("akzeptiert nur 15, 30 oder 45 Minuten", async () => {
    await expect(registerArena(deps, registration({ durationMin: 60 }).body)).rejects.toThrow();
  });

  it("verhindert Doppelanmeldung", async () => {
    const { body } = registration();
    await registerArena(deps, body);
    await expectArenaError(registerArena(deps, body), 409, "exists");
  });
});

describe("Upload in Teilen", () => {
  async function registered() {
    const r = registration();
    await registerArena(deps, r.body);
    return r.id.retrievalId;
  }
  const bytes = (n: number, fill: number) => new Uint8Array(n).fill(fill);

  it("setzt fort, erkennt falsche Offsets und legt am Ende einen Job an", async () => {
    const id = await registered();
    await initUpload(deps, id, { size: 250, mimeType: "video/mp4", recordingEndedAt: "2026-09-30T07:50:00Z" });
    expect((await appendChunk(deps, id, 0, bytes(100, 1))).offset).toBe(100);
    await expectArenaError(appendChunk(deps, id, 0, bytes(100, 1)), 409, "offset");
    // Verbindungsabbruch → Status abfragen und fortsetzen
    expect((await uploadStatus(deps, id)).offset).toBe(100);
    await appendChunk(deps, id, 100, bytes(100, 2));
    const last = await appendChunk(deps, id, 200, bytes(50, 3));
    expect(last.complete).toBe(true);

    const doc = store.arenas.get(id)!;
    expect(doc.status).toBe("queued");
    expect(doc.quizUnlockAt?.toISOString()).toBe("2026-09-30T08:35:00.000Z");
    expect([...store.jobs.values()]).toHaveLength(1);
    const file = await readFile(doc.upload!.path);
    expect(file.length).toBe(250);
    expect(file[99]).toBe(1);
    expect(file[100]).toBe(2);
    expect(file[249]).toBe(3);
    expect(path.basename(doc.upload!.path)).not.toContain(id);
  });

  it("lehnt zu große Aufnahmen, zu große Teile und Überlauf ab", async () => {
    const id = await registered();
    await expectArenaError(initUpload(deps, id, { size: 5000, mimeType: "video/mp4", recordingEndedAt: now.toISOString() }), 413, "too_large");
    await initUpload(deps, id, { size: 150, mimeType: "video/mp4", recordingEndedAt: now.toISOString() });
    await expectArenaError(appendChunk(deps, id, 0, bytes(101, 0)), 413, "chunk");
    await appendChunk(deps, id, 0, bytes(100, 0));
    await expectArenaError(appendChunk(deps, id, 100, bytes(60, 0)), 413, "overflow");
  });

  it("akzeptiert nur Videoformate", async () => {
    const id = await registered();
    await expect(initUpload(deps, id, { size: 10, mimeType: "image/png", recordingEndedAt: now.toISOString() })).rejects.toThrow();
  });
});

describe("Streaming-Upload (Laptop)", () => {
  it("nimmt Teile ohne feste Größe an und schließt mit completeUpload ab", async () => {
    const r = registration();
    await registerArena(deps, r.body);
    const id = r.id.retrievalId;
    await initUpload(deps, id, { size: null, mimeType: "video/webm", recordingEndedAt: now.toISOString() });
    await appendChunk(deps, id, 0, new Uint8Array(100));
    const mid = await appendChunk(deps, id, 100, new Uint8Array(30));
    expect(mid.complete).toBe(false);
    now = new Date(now.getTime() + 15 * 60_000);
    await completeUpload(deps, id);
    const doc = store.arenas.get(id)!;
    expect(doc.status).toBe("queued");
    expect(doc.upload!.size).toBe(130);
    expect(doc.quizUnlockAt!.getTime()).toBe(now.getTime() + 45 * 60_000);
    expect(store.jobs.size).toBe(1);
  });

  it("begrenzt Streaming auf die Maximalgröße und lehnt leere Aufnahmen ab", async () => {
    const r = registration();
    await registerArena(deps, r.body);
    const id = r.id.retrievalId;
    await initUpload(deps, id, { size: null, mimeType: "video/webm", recordingEndedAt: now.toISOString() });
    await expectArenaError(completeUpload(deps, id), 400, "empty");
    for (let o = 0; o < 1000; o += 100) await appendChunk(deps, id, o, new Uint8Array(100));
    await expectArenaError(appendChunk(deps, id, 1000, new Uint8Array(1)), 413, "overflow");
  });
});

describe("verschlüsselter Client-Zustand", () => {
  it("wird unverändert gespeichert und zurückgegeben", async () => {
    const blob = { schemaVersion: 1, ephemeralPublicKey: toB64(new Uint8Array(32).fill(1)), iv: "AAAAAAAAAAAAAAAA", ciphertext: "YWJj" };
    const r = registration({ clientState: blob });
    await registerArena(deps, r.body);
    expect((await getStatus(deps, r.id.retrievalId)).clientState).toEqual(blob);
  });
  it("weist Klartext ab", async () => {
    await expect(registerArena(deps, registration({ clientState: { word: "Anker" } }).body)).rejects.toThrow();
  });
});

describe("Status und Löschen", () => {
  it("gibt den Bericht erst nach dem Behaltensintervall heraus", async () => {
    const r = registration();
    await registerArena(deps, r.body);
    const id = r.id.retrievalId;
    const blob = { schemaVersion: 1 as const, ephemeralPublicKey: "x", iv: "y", ciphertext: "z" };
    await store.updateArena(id, { status: "ready", result: blob, quizUnlockAt: new Date(now.getTime() + 60_000) });
    expect((await getStatus(deps, id)).result).toBeNull();
    now = new Date(now.getTime() + 61_000);
    expect((await getStatus(deps, id)).result).toEqual(blob);
  });

  it("gibt den Bericht früher heraus, wenn die Lehrkraft freigibt", async () => {
    store.classes.set("c", classDoc({ _id: "c", joinCode: "KMS234", guardianConsentConfirmed: true, retentionMin: 24 * 60, reportsReleasedAt: null, state: "open", expiresAt: now }));
    const r = registration({ classCode: "KMS234" });
    await registerArena(deps, r.body);
    const id = r.id.retrievalId;
    await store.updateArena(id, { status: "ready", result: { schemaVersion: 1, ephemeralPublicKey: "a", iv: "b", ciphertext: "c" }, quizUnlockAt: new Date(now.getTime() + 86_400_000) });
    expect((await getStatus(deps, id)).result).toBeNull();
    store.classes.get("c")!.reportsReleasedAt = now;
    expect((await getStatus(deps, id)).result).not.toBeNull();
  });

  it("löscht Session, Upload-Datei und Jobs vollständig", async () => {
    const r = registration();
    await registerArena(deps, r.body);
    const id = r.id.retrievalId;
    await initUpload(deps, id, { size: 10, mimeType: "video/webm", recordingEndedAt: now.toISOString() });
    await appendChunk(deps, id, 0, new Uint8Array(10));
    await deleteArena(deps, id);
    expect(store.arenas.size).toBe(0);
    expect(store.jobs.size).toBe(0);
    expect(await readdir(dir)).toEqual([]);
    await expectArenaError(getStatus(deps, id), 404, "not_found");
  });
});
