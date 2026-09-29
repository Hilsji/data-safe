"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: { background: "var(--accent)", color: "var(--accent-contrast)", borderColor: "var(--accent)" },
    secondary: { background: "transparent", color: "var(--text)", borderColor: "var(--border)" },
    danger: { background: "transparent", color: "var(--danger)", borderColor: "var(--danger)" },
  }[variant];
  return (
    <button
      {...props}
      className={`min-h-11 rounded-lg border-2 px-5 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={styles}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border p-5 ${className}`} style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {children}
    </div>
  );
}

/** Überschrift eines Schritts; bekommt beim Erscheinen den Fokus (Screenreader hören den Schrittwechsel). */
export function StepHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h2 ref={ref} tabIndex={-1} className="mb-4 text-2xl font-bold outline-none">
      {children}
    </h2>
  );
}

export function Progress({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <nav aria-label="Fortschritt" className="mb-6">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Schritt {current + 1} von {steps.length}: {steps[current]}
      </p>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {steps.map((s, i) => (
          <span key={s} className="h-1.5 flex-1 rounded" style={{ background: i <= current ? "var(--accent)" : "var(--border)" }} />
        ))}
      </div>
    </nav>
  );
}

export function Choice<T extends string | number>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-semibold">{legend}</legend>
      {options.map((o) => (
        <label
          key={String(o.value)}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2"
          style={{ borderColor: value === o.value ? "var(--accent)" : "var(--border)" }}
        >
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="h-5 w-5" />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

export function Check({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
      <span>{label}</span>
    </label>
  );
}

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  const color = tone === "error" ? "var(--danger)" : tone === "success" ? "var(--success)" : "var(--accent)";
  return (
    <div role={tone === "error" ? "alert" : "status"} className="rounded-lg border-l-4 px-4 py-3" style={{ borderColor: color, background: "var(--surface)" }}>
      {children}
    </div>
  );
}
