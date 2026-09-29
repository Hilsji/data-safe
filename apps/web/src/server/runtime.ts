import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ArenaError, type ArenaDeps } from "./arena";
import { loadConfig } from "./config";
import { MongoStore } from "./mongoStore";
import { MemoryStore, type Store } from "./store";

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
  if (++b.count > limit) throw new ArenaError(429, "rate_limit", "Zu viele Anfragen – bitte kurz warten.");
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
