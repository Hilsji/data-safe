import { ApiError } from "./arenaClient";
import type { ClassOverview } from "@/server/classes";

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin" });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, String(body.error ?? "http"), String(body.message ?? res.statusText), body);
  return body as T;
}
const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export interface ClassListItem {
  id: string;
  title: string;
  joinCode: string;
  state: "open" | "running" | "closed";
  createdAt: string;
}

export const me = () => call<{ roles: string[] }>("/api/auth/me");
export const requestLink = (email: string) => call<{ ok: true }>("/api/auth/login", post({ email }));
export const logout = () => call<void>("/api/auth/logout", post());
export const listClasses = () => call<ClassListItem[]>("/api/class");
export const createClass = (body: unknown) => call<{ id: string; joinCode: string }>("/api/class", post(body));
export const getClass = (id: string) => call<ClassOverview>(`/api/class/${id}`);
export const classAction = (id: string, action: "start" | "release" | "close") => call<{ state: string }>(`/api/class/${id}/${action}`, post());
export const deleteClass = (id: string) => call<void>(`/api/class/${id}`, { method: "DELETE" });
