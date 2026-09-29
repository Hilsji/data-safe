"use client";

import { useId, useState } from "react";
import { FACTS, type FactId } from "@/content/facts";
import { SOURCES } from "@/content/sources";

/**
 * Einzige erlaubte Art, eine Zahl anzuzeigen: Wert + ⓘ mit Quelle und Jahr.
 * Nur Inline-Elemente, damit die Komponente in Fließtext (<p>) stehen darf.
 * Fakten mit Status "todo" werden nicht gerendert.
 */
export function Fact({ id }: { id: FactId }) {
  const fact = FACTS[id];
  const [open, setOpen] = useState(false);
  const noteId = useId();
  if ((fact.status as string) === "todo") return null;
  return (
    <span>
      <strong>{fact.value}</strong>{" "}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={noteId}
        aria-label={`Quelle zu: ${fact.label}`}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full align-baseline text-sm"
        style={{ color: "var(--accent)" }}
      >
        ⓘ
      </button>
      {open && (
        <span
          id={noteId}
          role="note"
          className="mt-1 block rounded border p-2 text-sm font-normal"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--muted)" }}
        >
          {fact.label}
          {fact.label.endsWith(".") ? " " : ". "}
          {fact.sources.map((s) => (
            <span key={s}>
              Quelle: {SOURCES[s].short} ({SOURCES[s].year}).{" "}
            </span>
          ))}
          {fact.status === "check" && <span>Wird vor dem Schuleinsatz noch fachlich geprüft.</span>}
        </span>
      )}
    </span>
  );
}
