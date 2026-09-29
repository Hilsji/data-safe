"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Check, StepHeading } from "@/components/ui";
import { DURATIONS, type DurationMin } from "@/engine/types";
import { de } from "@/i18n/de";
import { ApiError } from "@/lib/arenaClient";
import { createClass, listClasses, logout, me, requestLink, type ClassListItem } from "@/lib/teacherClient";

const t = de.teacher;
const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };

function LoginForm({ notice }: { notice: string | null }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="space-y-4">
      <StepHeading>{t.loginHeading}</StepHeading>
      {notice && <Alert tone="error">{notice}</Alert>}
      <p>{t.loginBody}</p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await requestLink(email);
            setSent(true);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : de.arena.errors.network);
          }
        }}
      >
        <label className="block">
          <span className="mb-1 block font-semibold">{t.email}</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11 w-full rounded-lg border px-3" style={inputStyle} />
        </label>
        <Button type="submit">{t.sendLink}</Button>
      </form>
      {sent && <Alert tone="success">{t.linkSent}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
    </section>
  );
}

function CreateClass({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [groups, setGroups] = useState<{ label: string; durationMin: DurationMin }[]>([
    { label: "Gruppe A", durationMin: 15 },
    { label: "Gruppe B", durationMin: 45 },
  ]);
  const [guardian, setGuardian] = useState(false);
  const [auto, setAuto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-bold">{t.createHeading}</h2>
      <label className="block">
        <span className="mb-1 block font-semibold">{t.classTitle}</span>
        <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} className="min-h-11 w-full rounded-lg border px-3" style={inputStyle} />
      </label>
      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold">{t.groupsLegend}</legend>
        {groups.map((g, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <label className="flex-1">
              <span className="block text-sm">{t.groupLabel}</span>
              <input
                value={g.label}
                maxLength={30}
                onChange={(e) => setGroups(groups.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                className="min-h-11 w-full rounded-lg border px-3"
                style={inputStyle}
              />
            </label>
            <label>
              <span className="block text-sm">{t.groupDuration}</span>
              <select
                value={g.durationMin}
                onChange={(e) => setGroups(groups.map((x, j) => (j === i ? { ...x, durationMin: Number(e.target.value) as DurationMin } : x)))}
                className="min-h-11 rounded-lg border px-2"
                style={inputStyle}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} {de.common.minutes}
                  </option>
                ))}
              </select>
            </label>
            {groups.length > 1 && (
              <Button variant="secondary" onClick={() => setGroups(groups.filter((_, j) => j !== i))} aria-label={`${t.removeGroup}: ${g.label}`}>
                ✕
              </Button>
            )}
          </div>
        ))}
        {groups.length < 3 && (
          <Button variant="secondary" onClick={() => setGroups([...groups, { label: `Gruppe ${"ABC"[groups.length]}`, durationMin: 30 }])}>
            {t.addGroup}
          </Button>
        )}
      </fieldset>
      <fieldset>
        <legend className="mb-1 font-semibold">{t.retention}</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="retention" checked={!auto} onChange={() => setAuto(false)} className="h-5 w-5" /> {t.retentionManual}
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="retention" checked={auto} onChange={() => setAuto(true)} className="h-5 w-5" /> {t.retentionAuto}
        </label>
      </fieldset>
      <Check label={t.guardian} checked={guardian} onChange={setGuardian} />
      {error && <Alert tone="error">{error}</Alert>}
      <Button
        disabled={!title.trim() || groups.some((g) => !g.label.trim())}
        onClick={async () => {
          setError(null);
          try {
            // „selbst freischalten“: sehr langes Intervall, die Freigabe kommt per Button
            await createClass({ title, groups, guardianConsentConfirmed: guardian, retentionMin: auto ? 45 : 7 * 24 * 60 });
            setTitle("");
            onCreated();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : de.arena.errors.network);
          }
        }}
      >
        {t.create}
      </Button>
    </Card>
  );
}

export function TeacherHome({ loginNotice }: { loginNotice: string | null }) {
  const [roles, setRoles] = useState<string[] | null>(null);
  const [classes, setClasses] = useState<ClassListItem[]>([]);

  const refresh = useCallback(async () => {
    const r = await me().catch(() => ({ roles: [] as string[] }));
    setRoles(r.roles);
    if (r.roles.includes("teacher")) setClasses(await listClasses().catch(() => []));
  }, []);

  useEffect(() => {
    // Laden beim Öffnen (externer Zustand: Sitzung auf dem Server)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten werden asynchron geladen, kein synchrones setState
    void refresh();
  }, [refresh]);

  if (roles === null) return <p>{de.common.loading}</p>;
  if (!roles.includes("teacher")) return <LoginForm notice={loginNotice} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <StepHeading>{t.listHeading}</StepHeading>
        <Button variant="secondary" onClick={async () => { await logout(); setRoles([]); }}>
          {t.logout}
        </Button>
      </div>
      {classes.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>{t.listEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {classes.map((c) => (
            <li key={c.id}>
              <Link href={`/lehrkraft/klasse/${c.id}`} className="block">
                <Card className="flex items-center justify-between !py-3">
                  <span className="font-semibold">{c.title}</span>
                  <span className="font-mono">{c.joinCode}</span>
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {t.states[c.state]}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CreateClass onCreated={refresh} />
    </div>
  );
}
