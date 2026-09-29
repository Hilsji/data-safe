import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ArenaError, type ArenaDeps } from "./arena";
import { loadConfig } from "./config";
import { MongoStore } from "./mongoStore";
import { MemoryStore, type Role, type Store } from "./store";
import { loadAuthConfig, SESSION_COOKIE, userFromSessionToken, type AuthConfig, type Mailer, type User } from "./auth";
import { createMailer } from "./mailer";

let depsPromise: Promise<ArenaDeps> | null = null;

/** Eine Store-Instanz pro Prozess. Ohne MONGODB_URI läuft ein In-Memory-Store (nur für lokale Entwicklung). */
export function getDeps(): Promise<ArenaDeps> {
  depsPromise ??= (async () => {
    const config = loadConfig();
    let store: Store;
    if (config.mongoUri) {
      store = await MongoStore.connect(config.mongoUri, config.mongoDb);
    } else {
      if (process.env.NODE_ENV === "production") throw new Error("MONGODB_URI fehlt");
      console.warn("[guide-me] MONGODB_URI nicht gesetzt – In-Memory-Store (Daten gehen beim Neustart verloren).");
      store = new MemoryStore();
    }
    return { store, config };
  })();
  return depsPromise;
}

/** Einfaches Rate-Limit pro IP (Schutz gegen Durchprobieren von IDs). */
const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(req: Request, limit = 120, windowMs = 60_000): void {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return;
  }
  // RATE_LIMIT_FACTOR: z. B. für automatisierte Tests, die alle von derselben IP kommen (Standard 1)
  const factor = Number(process.env.RATE_LIMIT_FACTOR ?? "1") || 1;
  if (++b.count > limit * factor) throw new ArenaError(429, "rate_limit", "Zu viele Anfragen – bitte kurz warten.");
}

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ArenaError) {
    return NextResponse.json({ error: e.code, message: e.message, ...e.extra }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json({ error: "invalid", message: "Ungültige Eingabe.", issues: e.issues.map((i) => i.path.join(".")) }, { status: 400 });
  }
  console.error("[guide-me] Unerwarteter Fehler:", e instanceof Error ? e.message : "unbekannt");
  return NextResponse.json({ error: "internal", message: "Interner Fehler." }, { status: 500 });
}

export const noStore = { "Cache-Control": "no-store" };

let authCfg: AuthConfig | null = null;
let mailer: Mailer | null = null;
export function getAuth(): { cfg: AuthConfig; mailer: Mailer } {
  authCfg ??= loadAuthConfig();
  mailer ??= createMailer();
  return { cfg: authCfg, mailer };
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export async function currentUser(req: Request): Promise<User | null> {
  const { store } = await getDeps();
  return userFromSessionToken(store, readCookie(req, SESSION_COOKIE));
}

/** Wirft 401/403 als ArenaError, wenn die Rolle fehlt. */
export async function requireRole(req: Request, role: Role): Promise<User> {
  const user = await currentUser(req);
  if (!user) throw new ArenaError(401, "auth", "Bitte melde dich an.");
  if (!user.roles.includes(role)) throw new ArenaError(403, "forbidden", "Dafür fehlt dir die Berechtigung.");
  return user;
}

/** Schreibende Anfragen mit Cookie nur von der eigenen Seite (CSRF-Schutz zusätzlich zu SameSite=Lax). */
export function requireSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) throw new ArenaError(403, "origin", "Ungültige Herkunft der Anfrage.");
}
