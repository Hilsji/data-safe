/**
 * Magic-Link-Anmeldung für Lehrkräfte, Rater und Admins.
 * Gespeichert werden nur Hashes: userId = HMAC(E-Mail), Login- und Sitzungs-Token als SHA-256.
 * Wer sich anmelden darf, steht in Umgebungsvariablen (Allowlist), nicht in der Datenbank.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Role, Store } from "./store";

export interface AuthConfig {
  secret: string;
  appUrl: string;
  teacherEmails: string[];
  teacherDomains: string[];
  raterEmails: string[];
  adminEmails: string[];
  loginTtlMin: number;
  sessionTtlHours: number;
}

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function loadAuthConfig(): AuthConfig {
  const secret = process.env.AUTH_SECRET ?? "";
  if (process.env.NODE_ENV === "production" && secret.length < 32) throw new Error("AUTH_SECRET (≥ 32 Zeichen) fehlt");
  return {
    secret: secret || "dev-secret-nur-fuer-lokale-entwicklung",
    appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
    teacherEmails: list(process.env.TEACHER_EMAILS),
    teacherDomains: list(process.env.TEACHER_EMAIL_DOMAINS),
    raterEmails: list(process.env.RATER_EMAILS),
    adminEmails: list(process.env.ADMIN_EMAILS),
    loginTtlMin: 15,
    sessionTtlHours: 10,
  };
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const userIdFor = (cfg: AuthConfig, email: string) => createHmac("sha256", cfg.secret).update(normalizeEmail(email)).digest("hex").slice(0, 32);

export function rolesFor(cfg: AuthConfig, rawEmail: string): Role[] {
  const email = normalizeEmail(rawEmail);
  const domain = email.split("@")[1] ?? "";
  const roles: Role[] = [];
  if (cfg.teacherEmails.includes(email) || cfg.teacherDomains.includes(domain) || cfg.adminEmails.includes(email)) roles.push("teacher");
  if (cfg.raterEmails.includes(email) || cfg.adminEmails.includes(email)) roles.push("rater");
  if (cfg.adminEmails.includes(email)) roles.push("admin");
  return roles;
}

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,}$/i;

/** Antwortet immer gleich – verrät nicht, ob eine Adresse berechtigt ist. */
export async function requestLogin(store: Store, cfg: AuthConfig, mailer: Mailer, rawEmail: string, now = new Date()): Promise<void> {
  if (!EMAIL_RE.test(rawEmail.trim())) return;
  const roles = rolesFor(cfg, rawEmail);
  if (roles.length === 0) return;
  const token = randomBytes(32).toString("base64url");
  await store.insertLoginToken({
    _id: sha256(token),
    userId: userIdFor(cfg, rawEmail),
    roles,
    expiresAt: new Date(now.getTime() + cfg.loginTtlMin * 60_000),
  });
  const link = `${cfg.appUrl}/login/verify?token=${token}`;
  await mailer.send(
    normalizeEmail(rawEmail),
    "Dein Anmelde-Link – Guide me on the right way.",
    `Hallo,\n\nmit diesem Link meldest du dich an (gültig ${cfg.loginTtlMin} Minuten, nur einmal nutzbar):\n\n${link}\n\nWenn du das nicht angefordert hast, ignoriere diese Mail.\n`,
  );
}

/** Löst den Link ein und liefert den Sitzungs-Token für das Cookie (oder null). */
export async function verifyLogin(store: Store, cfg: AuthConfig, token: string, now = new Date()): Promise<{ sessionToken: string; maxAgeSec: number; roles: Role[] } | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const doc = await store.consumeLoginToken(sha256(token));
  if (!doc || doc.expiresAt <= now) return null;
  const sessionToken = randomBytes(32).toString("base64url");
  const maxAgeSec = cfg.sessionTtlHours * 3600;
  await store.insertUserSession({ _id: sha256(sessionToken), userId: doc.userId, roles: doc.roles, expiresAt: new Date(now.getTime() + maxAgeSec * 1000) });
  return { sessionToken, maxAgeSec, roles: doc.roles };
}

export interface User {
  userId: string;
  roles: Role[];
}

export async function userFromSessionToken(store: Store, token: string | undefined, now = new Date()): Promise<User | null> {
  if (!token) return null;
  const s = await store.getUserSession(sha256(token));
  if (!s || s.expiresAt <= now) return null;
  return { userId: s.userId, roles: s.roles };
}

export const SESSION_COOKIE = "gm_session";
