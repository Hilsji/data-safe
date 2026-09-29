/**
 * Datenzugriff. Zwei Implementierungen: MongoDB (Betrieb) und In-Memory (Tests, lokale Demo ohne DB).
 * Gespeichert wird nur, was docs/ARCHITEKTUR.md, Abschnitt 5.1 erlaubt – keine Inhalte, kein Klartext-Ergebnis.
 */
import type { EncryptedBlob } from "@/crypto/ecies";
import type { DurationMin, SourceApp } from "@/engine/types";

export type AgeBand = "u14" | "14-15" | "16+";
export type ArenaStatus = "registered" | "uploading" | "queued" | "processing" | "ready" | "failed";

export interface ArenaSessionDoc {
  _id: string; // retrievalId
  publicKey: string; // base64, X25519
  durationMin: DurationMin;
  app: SourceApp;
  ageBand: Exclude<AgeBand, "u14">;
  consents: { analysis: true; politicsSpectrum: boolean; guardianConfirmed: boolean };
  classSessionId: string | null;
  status: ArenaStatus;
  /** size = null während eines Streaming-Uploads */
  upload: { size: number | null; received: number; mimeType: string; path: string } | null;
  recordingEndedAt: Date | null;
  quizUnlockAt: Date | null;
  progress: number;
  failureReason: string | null;
  result: EncryptedBlob | null;
  /** vom Client verschlüsselt (Baseline, Merkwort) – für den Server unlesbar */
  clientState: EncryptedBlob | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface JobDoc {
  _id: string;
  arenaSessionId: string;
  uploadPath: string;
  state: "queued" | "running" | "done" | "failed";
  attempts: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface ClassSessionDoc {
  _id: string;
  joinCode: string;
  guardianConsentConfirmed: boolean;
  retentionMin: number | null;
  /** Lehrkraft gibt die Berichte frei (z. B. zu Beginn der Folgestunde); null = nach retentionMin */
  reportsReleasedAt: Date | null;
  state: "open" | "running" | "closed";
  expiresAt: Date;
}

export interface Store {
  getArena(id: string): Promise<ArenaSessionDoc | null>;
  insertArena(doc: ArenaSessionDoc): Promise<"ok" | "exists">;
  updateArena(id: string, patch: Partial<ArenaSessionDoc>): Promise<void>;
  deleteArena(id: string): Promise<void>;
  insertJob(doc: JobDoc): Promise<void>;
  deleteJobsForArena(arenaId: string): Promise<void>;
  getClassByCode(code: string): Promise<ClassSessionDoc | null>;
  getClass(id: string): Promise<ClassSessionDoc | null>;
}

export class MemoryStore implements Store {
  arenas = new Map<string, ArenaSessionDoc>();
  jobs = new Map<string, JobDoc>();
  classes = new Map<string, ClassSessionDoc>();

  async getArena(id: string) {
    return structuredClone(this.arenas.get(id) ?? null);
  }
  async insertArena(doc: ArenaSessionDoc) {
    if (this.arenas.has(doc._id)) return "exists" as const;
    this.arenas.set(doc._id, structuredClone(doc));
    return "ok" as const;
  }
  async updateArena(id: string, patch: Partial<ArenaSessionDoc>) {
    const cur = this.arenas.get(id);
    if (cur) this.arenas.set(id, { ...cur, ...structuredClone(patch) });
  }
  async deleteArena(id: string) {
    this.arenas.delete(id);
  }
  async insertJob(doc: JobDoc) {
    this.jobs.set(doc._id, structuredClone(doc));
  }
  async deleteJobsForArena(arenaId: string) {
    for (const [k, j] of this.jobs) if (j.arenaSessionId === arenaId) this.jobs.delete(k);
  }
  async getClassByCode(code: string) {
    return [...this.classes.values()].find((c) => c.joinCode === code) ?? null;
  }
  async getClass(id: string) {
    return this.classes.get(id) ?? null;
  }
}
