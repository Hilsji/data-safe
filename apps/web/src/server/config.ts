import path from "node:path";

/** Server-Konfiguration aus Umgebungsvariablen (siehe .env.example). */
export interface ServerConfig {
  mongoUri: string | null;
  mongoDb: string;
  /** Upload-Verzeichnis – in der Schul-Box ein tmpfs-Volume, das mit dem Worker geteilt wird */
  uploadDir: string;
  maxUploadBytes: number;
  maxChunkBytes: number;
  /** Ergebnis-TTL (Tage) */
  resultTtlDays: number;
  /** Zeit bis zum Quiz nach Ende der Aufnahme, wenn keine Klassen-Session sie vorgibt (Minuten) */
  defaultRetentionMin: number;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} muss eine positive Zahl sein`);
  return n;
}

export function loadConfig(): ServerConfig {
  return {
    mongoUri: process.env.MONGODB_URI ?? null,
    mongoDb: process.env.MONGODB_DB ?? "guide_me",
    uploadDir: path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads"),
    maxUploadBytes: int("MAX_UPLOAD_BYTES", 6 * 1024 ** 3),
    maxChunkBytes: int("MAX_CHUNK_BYTES", 8 * 1024 ** 2),
    resultTtlDays: int("RESULT_TTL_DAYS", 7),
    defaultRetentionMin: int("DEFAULT_RETENTION_MIN", 45),
  };
}
