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

export interface ClassGroup {
  id: "A" | "B" | "C";
  label: string;
  durationMin: DurationMin;
}

export interface ClassSessionDoc {
  _id: string;
  joinCode: string;
  /** HMAC der E-Mail der Lehrkraft */
  teacherId: string;
  title: string;
  groups: ClassGroup[];
  guardianConsentConfirmed: boolean;
  retentionMin: number | null;
  /** Lehrkraft gibt die Berichte frei (z. B. zu Beginn der Folgestunde); null = nach retentionMin */
  reportsReleasedAt: Date | null;
  state: "open" | "running" | "closed";
  startedAt: Date | null;
  /** atomar hochgezählt: verteilt Beitretende reihum auf die Gruppen, auch bei gleichzeitigem Beitritt */
  joinCount: number;
  createdAt: Date;
  expiresAt: Date;
}

/** Nur für die Anzeige „wer ist drin“ – nie mit Ergebnissen verknüpft */
export interface ParticipantDoc {
  _id: string;
  classId: string;
  pseudonym: string;
  groupId: ClassGroup["id"];
  joinedAt: Date;
  expiresAt: Date;
}

export interface ContributionTokenDoc {
  _id: string; // SHA-256 des Tokens
  classId: string;
  groupId: ClassGroup["id"];
  expiresAt: Date;
}

/** Nur Zähler – pro Klasse × Gruppe */
export interface ClassAggregateDoc {
  _id: string; // `${classId}:${groupId}`
  classId: string;
  groupId: ClassGroup["id"];
  n: number;
  contentCorrectHist: number[];
  recognitionDPrimeHist: number[];
  videosSeenHist: number[];
  prospectiveSuccess: number;
  prospectiveTotal: number;
  topCategoryCounts: Record<string, number>;
  entropyDropHist: number[];
  expiresAt: Date;
}

export type Role = "teacher" | "rater" | "admin";

export interface LoginTokenDoc {
  _id: string; // SHA-256 des Tokens
  userId: string;
  roles: Role[];
  expiresAt: Date;
}

export interface UserSessionDoc {
  _id: string; // SHA-256 des Cookie-Werts
  userId: string;
  roles: Role[];
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
  insertClass(doc: ClassSessionDoc): Promise<"ok" | "exists">;
  updateClass(id: string, patch: Partial<ClassSessionDoc>): Promise<void>;
  listClasses(teacherId: string): Promise<ClassSessionDoc[]>;
  /** atomar joinCount erhöhen, liefert den Wert VOR der Erhöhung (null = Klasse fehlt) */
  nextJoinIndex(classId: string): Promise<number | null>;
  /** Klasse samt Teilnehmenden, Tokens und Aggregaten löschen; Arena-Sessions verlieren nur den Bezug */
  deleteClass(id: string): Promise<void>;
  insertParticipant(doc: ParticipantDoc): Promise<void>;
  listParticipants(classId: string): Promise<ParticipantDoc[]>;
  insertContributionToken(doc: ContributionTokenDoc): Promise<void>;
  /** atomar: Token entwerten und zurückgeben (null = unbekannt oder schon benutzt) */
  consumeContributionToken(hash: string): Promise<ContributionTokenDoc | null>;
  incAggregate(key: { classId: string; groupId: ClassGroup["id"] }, inc: Record<string, number>, expiresAt: Date): Promise<void>;
  getAggregates(classId: string): Promise<ClassAggregateDoc[]>;
  countArenasByStatus(classId: string): Promise<Record<string, number>>;
  insertLoginToken(doc: LoginTokenDoc): Promise<void>;
  consumeLoginToken(hash: string): Promise<LoginTokenDoc | null>;
  insertUserSession(doc: UserSessionDoc): Promise<void>;
  getUserSession(hash: string): Promise<UserSessionDoc | null>;
  deleteUserSession(hash: string): Promise<void>;
}

/** Leeres Aggregat mit den festen Bucket-Anzahlen */
export function emptyAggregate(classId: string, groupId: ClassGroup["id"], expiresAt: Date): ClassAggregateDoc {
  return {
    _id: `${classId}:${groupId}`,
    classId,
    groupId,
    n: 0,
    contentCorrectHist: Array(10).fill(0),
    recognitionDPrimeHist: Array(10).fill(0),
    videosSeenHist: Array(11).fill(0),
    prospectiveSuccess: 0,
    prospectiveTotal: 0,
    topCategoryCounts: {},
    entropyDropHist: Array(10).fill(0),
    expiresAt,
  };
}

/** Wendet $inc-Pfade wie "contentCorrectHist.3" oder "topCategoryCounts.food" auf ein Aggregat an */
export function applyInc(doc: ClassAggregateDoc, inc: Record<string, number>): ClassAggregateDoc {
  const out = structuredClone(doc) as unknown as Record<string, unknown>;
  for (const [path, by] of Object.entries(inc)) {
    const [field, key] = path.split(".") as [string, string | undefined];
    if (key === undefined) out[field] = ((out[field] as number) ?? 0) + by;
    else {
      const container = out[field] as Record<string, number> | number[];
      (container as Record<string, number>)[key] = ((container as Record<string, number>)[key] ?? 0) + by;
    }
  }
  return out as unknown as ClassAggregateDoc;
}

export class MemoryStore implements Store {
  arenas = new Map<string, ArenaSessionDoc>();
  jobs = new Map<string, JobDoc>();
  classes = new Map<string, ClassSessionDoc>();
  participants = new Map<string, ParticipantDoc>();
  contributionTokens = new Map<string, ContributionTokenDoc>();
  aggregates = new Map<string, ClassAggregateDoc>();
  loginTokens = new Map<string, LoginTokenDoc>();
  sessions = new Map<string, UserSessionDoc>();

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
    return structuredClone(this.classes.get(id) ?? null);
  }
  async insertClass(doc: ClassSessionDoc) {
    if (this.classes.has(doc._id) || [...this.classes.values()].some((c) => c.joinCode === doc.joinCode)) return "exists" as const;
    this.classes.set(doc._id, structuredClone(doc));
    return "ok" as const;
  }
  async updateClass(id: string, patch: Partial<ClassSessionDoc>) {
    const cur = this.classes.get(id);
    if (cur) this.classes.set(id, { ...cur, ...structuredClone(patch) });
  }
  async nextJoinIndex(classId: string) {
    const c = this.classes.get(classId);
    if (!c) return null;
    return c.joinCount++;
  }
  async listClasses(teacherId: string) {
    return [...this.classes.values()].filter((c) => c.teacherId === teacherId).map((c) => structuredClone(c));
  }
  async deleteClass(id: string) {
    this.classes.delete(id);
    for (const [k, v] of this.participants) if (v.classId === id) this.participants.delete(k);
    for (const [k, v] of this.contributionTokens) if (v.classId === id) this.contributionTokens.delete(k);
    for (const [k, v] of this.aggregates) if (v.classId === id) this.aggregates.delete(k);
    for (const a of this.arenas.values()) if (a.classSessionId === id) a.classSessionId = null;
  }
  async insertParticipant(doc: ParticipantDoc) {
    this.participants.set(doc._id, structuredClone(doc));
  }
  async listParticipants(classId: string) {
    return [...this.participants.values()].filter((p) => p.classId === classId);
  }
  async insertContributionToken(doc: ContributionTokenDoc) {
    this.contributionTokens.set(doc._id, structuredClone(doc));
  }
  async consumeContributionToken(hash: string) {
    const t = this.contributionTokens.get(hash) ?? null;
    this.contributionTokens.delete(hash);
    return t;
  }
  async incAggregate(key: { classId: string; groupId: ClassGroup["id"] }, inc: Record<string, number>, expiresAt: Date) {
    const id = `${key.classId}:${key.groupId}`;
    const cur = this.aggregates.get(id) ?? emptyAggregate(key.classId, key.groupId, expiresAt);
    this.aggregates.set(id, applyInc(cur, inc));
  }
  async getAggregates(classId: string) {
    return [...this.aggregates.values()].filter((a) => a.classId === classId).map((a) => structuredClone(a));
  }
  async countArenasByStatus(classId: string) {
    const out: Record<string, number> = {};
    for (const a of this.arenas.values()) if (a.classSessionId === classId) out[a.status] = (out[a.status] ?? 0) + 1;
    return out;
  }
  async insertLoginToken(doc: LoginTokenDoc) {
    this.loginTokens.set(doc._id, structuredClone(doc));
  }
  async consumeLoginToken(hash: string) {
    const t = this.loginTokens.get(hash) ?? null;
    this.loginTokens.delete(hash);
    return t;
  }
  async insertUserSession(doc: UserSessionDoc) {
    this.sessions.set(doc._id, structuredClone(doc));
  }
  async getUserSession(hash: string) {
    return structuredClone(this.sessions.get(hash) ?? null);
  }
  async deleteUserSession(hash: string) {
    this.sessions.delete(hash);
  }
}
