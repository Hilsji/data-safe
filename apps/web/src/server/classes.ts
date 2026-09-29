/**
 * Klassen-Sessions (Modul 4). Die Lehrkraft sieht nur anonyme Zähler – und das erst,
 * wenn sie die Runde geschlossen hat und in der Gruppe mindestens MIN_GROUP_SIZE Beiträge sind.
 * Nach dem Schließen nimmt der Server keine Beiträge mehr an: Das Ergebnis ist eingefroren,
 * damit niemand durch Vorher-Nachher-Vergleich auf einen einzelnen Beitrag schließen kann.
 */
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { contributionSchema, MIN_GROUP_SIZE, type Contribution } from "@/engine/aggregate";
import { DURATIONS } from "@/engine/types";
import { ArenaError } from "./arena";
import type { ClassAggregateDoc, ClassGroup, ClassSessionDoc, Store } from "./store";

const DAY_MS = 86_400_000;
export const CLASS_TTL_DAYS = 7;
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUP_IDS = ["A", "B", "C"] as const;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function generateJoinCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

const ADJECTIVES = ["Blauer", "Grüner", "Stiller", "Flinker", "Mutiger", "Heller", "Wilder", "Kluger", "Roter", "Ruhiger"];
const ANIMALS = ["Otter", "Falke", "Luchs", "Igel", "Wal", "Fuchs", "Dachs", "Biber", "Kranich", "Lemur"];

/** Generiertes Pseudonym – bewusst kein Freitext, damit keine Klarnamen im System landen. */
export function generatePseudonym(): string {
  return `${ADJECTIVES[randomInt(ADJECTIVES.length)]} ${ANIMALS[randomInt(ANIMALS.length)]} ${randomInt(10, 100)}`;
}

const durationSchema = z.union(DURATIONS.map((d) => z.literal(d)) as [z.ZodLiteral<15>, z.ZodLiteral<30>, z.ZodLiteral<45>]);

export const createClassSchema = z
  .object({
    title: z.string().trim().min(1).max(60),
    groups: z
      .array(z.object({ label: z.string().trim().min(1).max(30), durationMin: durationSchema }).strict())
      .min(1)
      .max(3),
    guardianConsentConfirmed: z.boolean(),
    retentionMin: z.number().int().min(10).max(7 * 24 * 60).nullable(),
  })
  .strict();

export interface ClassDeps {
  store: Store;
  now?: () => Date;
}
const nowOf = (d: ClassDeps) => (d.now ?? (() => new Date()))();

export async function createClass(deps: ClassDeps, teacherId: string, raw: unknown): Promise<ClassSessionDoc> {
  const input = createClassSchema.parse(raw);
  const now = nowOf(deps);
  for (let attempt = 0; attempt < 10; attempt++) {
    const doc: ClassSessionDoc = {
      _id: randomUUID(),
      joinCode: generateJoinCode(),
      teacherId,
      title: input.title,
      groups: input.groups.map((g, i) => ({ id: GROUP_IDS[i]!, label: g.label, durationMin: g.durationMin })),
      guardianConsentConfirmed: input.guardianConsentConfirmed,
      retentionMin: input.retentionMin,
      reportsReleasedAt: null,
      state: "open",
      startedAt: null,
      joinCount: 0,
      createdAt: now,
      expiresAt: new Date(now.getTime() + CLASS_TTL_DAYS * DAY_MS),
    };
    if ((await deps.store.insertClass(doc)) === "ok") return doc;
  }
  throw new ArenaError(500, "code", "Es konnte kein freier Klassen-Code erzeugt werden.");
}

export async function requireOwnClass(deps: ClassDeps, teacherId: string, id: string): Promise<ClassSessionDoc> {
  const cls = await deps.store.getClass(id);
  // Fremde Klassen sehen aus wie nicht vorhandene
  if (!cls || cls.teacherId !== teacherId) throw new ArenaError(404, "not_found", "Klassen-Session nicht gefunden.");
  return cls;
}

export type ClassAction = "start" | "release" | "close";

export async function classAction(deps: ClassDeps, teacherId: string, id: string, action: ClassAction): Promise<ClassSessionDoc> {
  const cls = await requireOwnClass(deps, teacherId, id);
  const now = nowOf(deps);
  if (cls.state === "closed") throw new ArenaError(409, "closed", "Die Runde ist bereits geschlossen.");
  const patch: Partial<ClassSessionDoc> =
    action === "start" ? { state: "running", startedAt: now } : action === "release" ? { reportsReleasedAt: now } : { state: "closed" };
  await deps.store.updateClass(id, patch);
  return { ...cls, ...patch };
}

export interface JoinResult {
  classTitle: string;
  groupId: ClassGroup["id"];
  groupLabel: string;
  durationMin: ClassGroup["durationMin"];
  pseudonym: string;
  /** anonymer Einmal-Token für den späteren Beitrag – der Server speichert nur seinen Hash, ohne Bezug zum Pseudonym */
  contributionToken: string;
  guardianConsentConfirmed: boolean;
  startedAt: string | null;
}

export async function joinClass(deps: ClassDeps, rawCode: unknown): Promise<JoinResult> {
  const code = z.string().trim().toUpperCase().regex(/^[0-9A-HJKMNP-TV-Z]{6}$/).parse(rawCode);
  const cls = await deps.store.getClassByCode(code);
  if (!cls || cls.state === "closed") throw new ArenaError(404, "class", "Klassen-Code nicht gefunden.");
  const now = nowOf(deps);
  // Gruppen reihum füllen – atomarer Zähler, damit gleichzeitige Beitritte nicht alle in derselben Gruppe landen
  const index = await deps.store.nextJoinIndex(cls._id);
  if (index === null) throw new ArenaError(404, "class", "Klassen-Code nicht gefunden.");
  const group = cls.groups[index % cls.groups.length]!;
  const pseudonym = generatePseudonym();
  await deps.store.insertParticipant({ _id: randomUUID(), classId: cls._id, pseudonym, groupId: group.id, joinedAt: now, expiresAt: cls.expiresAt });
  const token = randomBytes(24).toString("base64url");
  await deps.store.insertContributionToken({ _id: sha256(token), classId: cls._id, groupId: group.id, expiresAt: cls.expiresAt });
  return {
    classTitle: cls.title,
    groupId: group.id,
    groupLabel: group.label,
    durationMin: group.durationMin,
    pseudonym,
    contributionToken: token,
    guardianConsentConfirmed: cls.guardianConsentConfirmed,
    startedAt: cls.startedAt?.toISOString() ?? null,
  };
}

/** Anonymer Beitrag nach dem Quiz. Politik ist schon im Schema ausgeschlossen. */
export async function contribute(deps: ClassDeps, raw: unknown): Promise<void> {
  const c: Contribution = contributionSchema.parse(raw);
  const token = await deps.store.consumeContributionToken(sha256(c.token));
  if (!token) throw new ArenaError(409, "token", "Dieser Beitrag wurde schon gezählt oder ist ungültig.");
  const cls = await deps.store.getClass(token.classId);
  if (!cls) throw new ArenaError(404, "class", "Die Klassen-Session gibt es nicht mehr.");
  if (cls.state === "closed") throw new ArenaError(409, "closed", "Die Lehrkraft hat die Runde schon geschlossen.");
  const group = cls.groups.find((g) => g.id === token.groupId);
  if (!group || group.durationMin !== c.durationMin) throw new ArenaError(400, "duration", "Die Dauer passt nicht zu deiner Gruppe.");

  const inc: Record<string, number> = {
    n: 1,
    [`videosSeenHist.${c.videosSeenBucket}`]: 1,
    [`entropyDropHist.${c.entropyDropBucket}`]: 1,
  };
  if (c.contentCorrectBucket !== null) inc[`contentCorrectHist.${c.contentCorrectBucket}`] = 1;
  if (c.recognitionDPrimeBucket !== null) inc[`recognitionDPrimeHist.${c.recognitionDPrimeBucket}`] = 1;
  if (c.prospectiveSuccess !== null) {
    inc.prospectiveTotal = 1;
    if (c.prospectiveSuccess) inc.prospectiveSuccess = 1;
  }
  if (c.topCategory) inc[`topCategoryCounts.${c.topCategory}`] = 1;
  await deps.store.incAggregate({ classId: cls._id, groupId: group.id }, inc, cls.expiresAt);
}

export type GroupResult =
  | { groupId: ClassGroup["id"]; label: string; durationMin: number; status: "suppressed"; n: number }
  | ({ groupId: ClassGroup["id"]; label: string; durationMin: number; status: "ok" } & Omit<ClassAggregateDoc, "_id" | "classId" | "groupId" | "expiresAt">);

export interface ClassOverview {
  id: string;
  title: string;
  joinCode: string;
  state: ClassSessionDoc["state"];
  groups: ClassGroup[];
  startedAt: string | null;
  reportsReleasedAt: string | null;
  guardianConsentConfirmed: boolean;
  participants: { pseudonym: string; groupId: string }[];
  /** nur Anzahlen je Status, keine IDs */
  progress: Record<string, number>;
  /** bis zum Schließen null */
  results: GroupResult[] | null;
}

export async function classOverview(deps: ClassDeps, teacherId: string, id: string): Promise<ClassOverview> {
  const cls = await requireOwnClass(deps, teacherId, id);
  const [participants, progress] = await Promise.all([deps.store.listParticipants(id), deps.store.countArenasByStatus(id)]);
  let results: GroupResult[] | null = null;
  if (cls.state === "closed") {
    const aggs = await deps.store.getAggregates(id);
    results = cls.groups.map((g) => {
      const a = aggs.find((x) => x.groupId === g.id);
      const base = { groupId: g.id, label: g.label, durationMin: g.durationMin };
      if (!a || a.n < MIN_GROUP_SIZE) return { ...base, status: "suppressed" as const, n: a?.n ?? 0 };
      const { _id: _i, classId: _c, groupId: _g, expiresAt: _e, ...counts } = a;
      return { ...base, status: "ok" as const, ...counts };
    });
  }
  return {
    id: cls._id,
    title: cls.title,
    joinCode: cls.joinCode,
    state: cls.state,
    groups: cls.groups,
    startedAt: cls.startedAt?.toISOString() ?? null,
    reportsReleasedAt: cls.reportsReleasedAt?.toISOString() ?? null,
    guardianConsentConfirmed: cls.guardianConsentConfirmed,
    participants: participants.map((p) => ({ pseudonym: p.pseudonym, groupId: p.groupId })).sort((a, b) => a.pseudonym.localeCompare(b.pseudonym)),
    progress,
    results,
  };
}
