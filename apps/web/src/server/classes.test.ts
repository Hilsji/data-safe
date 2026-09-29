import { beforeEach, describe, expect, it } from "vitest";
import { ArenaError } from "./arena";
import { classAction, classOverview, contribute, createClass, joinClass, type ClassDeps } from "./classes";
import { MemoryStore } from "./store";
import { loadAuthConfig, requestLogin, rolesFor, userFromSessionToken, verifyLogin, type Mailer } from "./auth";

let store: MemoryStore;
let deps: ClassDeps;
const T = "teacher-1";

beforeEach(() => {
  store = new MemoryStore();
  deps = { store, now: () => new Date("2026-10-01T08:00:00Z") };
});

const expectErr = (p: Promise<unknown>, status: number, code: string) =>
  expect(p).rejects.toSatisfy((e: unknown) => e instanceof ArenaError && e.status === status && e.code === code);

async function twoGroups() {
  return createClass(deps, T, {
    title: "8b Medienkunde",
    groups: [
      { label: "Kurz", durationMin: 15 },
      { label: "Lang", durationMin: 45 },
    ],
    guardianConsentConfirmed: true,
    retentionMin: null,
  });
}

function contribution(token: string, durationMin: 15 | 30 | 45, extra: Record<string, unknown> = {}) {
  return {
    token,
    durationMin,
    contentCorrectBucket: 6,
    recognitionDPrimeBucket: 4,
    videosSeenBucket: 2,
    prospectiveSuccess: true,
    topCategory: "gaming",
    entropyDropBucket: 7,
    ...extra,
  };
}

describe("Klassen-Session", () => {
  it("erzeugt Code und Gruppen, Gruppen füllen sich gleichmäßig", async () => {
    const cls = await twoGroups();
    expect(cls.joinCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
    const joins = await Promise.all(Array.from({ length: 10 }, () => joinClass(deps, cls.joinCode.toLowerCase())));
    const perGroup = joins.reduce<Record<string, number>>((acc, j) => ({ ...acc, [j.groupId]: (acc[j.groupId] ?? 0) + 1 }), {});
    expect(Math.abs((perGroup.A ?? 0) - (perGroup.B ?? 0))).toBeLessThanOrEqual(1);
    expect(joins.every((j) => /^[A-ZÄÖÜ][a-zäöü]+ [A-Z][a-z]+ \d{2}$/.test(j.pseudonym))).toBe(true);
  });

  it("speichert den Beitrags-Token nur als Hash und ohne Bezug zum Pseudonym", async () => {
    const cls = await twoGroups();
    const j = await joinClass(deps, cls.joinCode);
    const stored = JSON.stringify([...store.contributionTokens.values()]);
    expect(stored).not.toContain(j.contributionToken);
    expect(stored).not.toContain(j.pseudonym);
  });

  it("lehnt unbekannte oder geschlossene Klassen ab", async () => {
    await expectErr(joinClass(deps, "ZZZZZZ"), 404, "class");
    const cls = await twoGroups();
    await classAction(deps, T, cls._id, "close");
    await expectErr(joinClass(deps, cls.joinCode), 404, "class");
  });

  it("andere Lehrkräfte sehen fremde Klassen nicht", async () => {
    const cls = await twoGroups();
    await expectErr(classOverview(deps, "teacher-2", cls._id), 404, "not_found");
    await expectErr(classAction(deps, "teacher-2", cls._id, "close"), 404, "not_found");
  });
});

describe("Anonyme Aggregate", () => {
  it("zeigt nichts vor dem Schließen und unterdrückt Gruppen unter 5", async () => {
    const cls = await twoGroups();
    const joins = await Promise.all(Array.from({ length: 12 }, () => joinClass(deps, cls.joinCode)));
    const a = joins.filter((j) => j.groupId === "A");
    const b = joins.filter((j) => j.groupId === "B");
    for (const j of a) await contribute(deps, contribution(j.contributionToken, 15));
    for (const j of b.slice(0, 4)) await contribute(deps, contribution(j.contributionToken, 45));

    expect((await classOverview(deps, T, cls._id)).results).toBeNull();
    await classAction(deps, T, cls._id, "close");
    const results = (await classOverview(deps, T, cls._id)).results!;
    const ra = results.find((r) => r.groupId === "A")!;
    const rb = results.find((r) => r.groupId === "B")!;
    expect(ra.status).toBe("ok");
    if (ra.status === "ok") {
      expect(ra.n).toBe(6);
      expect(ra.contentCorrectHist[6]).toBe(6);
      expect(ra.topCategoryCounts).toEqual({ gaming: 6 });
      expect(ra.prospectiveSuccess).toBe(6);
    }
    expect(rb).toMatchObject({ status: "suppressed", n: 4 });
    expect(JSON.stringify(rb)).not.toContain("Hist");
  });

  it("nimmt jeden Token nur einmal an", async () => {
    const cls = await twoGroups();
    const j = await joinClass(deps, cls.joinCode);
    await contribute(deps, contribution(j.contributionToken, j.durationMin));
    await expectErr(contribute(deps, contribution(j.contributionToken, j.durationMin)), 409, "token");
  });

  it("nimmt nach dem Schließen nichts mehr an (Ergebnis bleibt eingefroren)", async () => {
    const cls = await twoGroups();
    const j = await joinClass(deps, cls.joinCode);
    await classAction(deps, T, cls._id, "close");
    await expectErr(contribute(deps, contribution(j.contributionToken, j.durationMin)), 409, "closed");
  });

  it("weist Politik und falsche Dauer ab", async () => {
    const cls = await twoGroups();
    const j = await joinClass(deps, cls.joinCode);
    await expect(contribute(deps, contribution(j.contributionToken, j.durationMin, { topCategory: "politics" }))).rejects.toThrow();
    await expect(contribute(deps, contribution(j.contributionToken, j.durationMin, { spectrum: "left" }))).rejects.toThrow();
    const wrong = j.durationMin === 15 ? 45 : 15;
    await expectErr(contribute(deps, contribution(j.contributionToken, wrong)), 400, "duration");
  });

  it("zeigt Teilnehmende nur als Pseudonyme und Fortschritt nur als Anzahlen", async () => {
    const cls = await twoGroups();
    await joinClass(deps, cls.joinCode);
    const o = await classOverview(deps, T, cls._id);
    expect(o.participants).toHaveLength(1);
    expect(Object.keys(o.participants[0]!)).toEqual(["pseudonym", "groupId"]);
    expect(o.progress).toEqual({});
  });

  it("Löschen entfernt Klasse, Teilnehmende, Tokens und Aggregate", async () => {
    const cls = await twoGroups();
    const j = await joinClass(deps, cls.joinCode);
    await contribute(deps, contribution(j.contributionToken, j.durationMin));
    await store.deleteClass(cls._id);
    expect(store.classes.size + store.participants.size + store.contributionTokens.size + store.aggregates.size).toBe(0);
  });
});

describe("Magic Link", () => {
  const sent: { to: string; text: string }[] = [];
  const mailer: Mailer = { send: async (to, _s, text) => void sent.push({ to, text }) };
  const cfg = {
    ...loadAuthConfig(),
    secret: "x".repeat(40),
    teacherDomains: ["schule.example"],
    raterEmails: ["rater@uni.example"],
    adminEmails: ["admin@uni.example"],
  };

  beforeEach(() => void (sent.length = 0));

  it("vergibt Rollen nur laut Allowlist", () => {
    expect(rolesFor(cfg, "Frau.Mueller@Schule.Example")).toEqual(["teacher"]);
    expect(rolesFor(cfg, "rater@uni.example")).toEqual(["rater"]);
    expect(rolesFor(cfg, "admin@uni.example")).toEqual(["teacher", "rater", "admin"]);
    expect(rolesFor(cfg, "fremd@gmail.example")).toEqual([]);
  });

  it("schickt nur berechtigten Adressen einen Link – ohne das zu verraten", async () => {
    await requestLogin(store, cfg, mailer, "fremd@gmail.example");
    expect(sent).toHaveLength(0);
    expect(store.loginTokens.size).toBe(0);
    await requestLogin(store, cfg, mailer, "lehrer@schule.example");
    expect(sent).toHaveLength(1);
  });

  it("Link ist einmalig, läuft ab und speichert weder E-Mail noch Token im Klartext", async () => {
    await requestLogin(store, cfg, mailer, "lehrer@schule.example");
    const token = sent[0]!.text.match(/token=([A-Za-z0-9_-]+)/)![1]!;
    expect(JSON.stringify([...store.loginTokens.values()])).not.toMatch(/lehrer|schule|token/);
    expect(JSON.stringify([...store.loginTokens.values()])).not.toContain(token);
    const session = await verifyLogin(store, cfg, token);
    expect(session).not.toBeNull();
    expect(await verifyLogin(store, cfg, token)).toBeNull();
    const user = await userFromSessionToken(store, session!.sessionToken);
    expect(user?.roles).toEqual(["teacher"]);

    await requestLogin(store, cfg, mailer, "lehrer@schule.example");
    const late = sent[1]!.text.match(/token=([A-Za-z0-9_-]+)/)![1]!;
    expect(await verifyLogin(store, cfg, late, new Date(Date.now() + 16 * 60_000))).toBeNull();
  });
});
