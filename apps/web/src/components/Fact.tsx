import { FACTS, type FactId } from "@/content/facts";
import { SOURCES } from "@/content/sources";

/**
 * Einzige erlaubte Art, eine Zahl anzuzeigen: Wert + ⓘ mit Quelle und Jahr.
 * Fakten mit Status "todo" werden nicht gerendert.
 */
export function Fact({ id }: { id: FactId }) {
  const fact = FACTS[id];
  if ((fact.status as string) === "todo") return null;
  return (
    <span className="inline">
      <strong>{fact.value}</strong>{" "}
      <details className="inline-block align-baseline">
        <summary
          className="inline-flex min-h-6 min-w-6 cursor-pointer list-none items-center justify-center rounded-full text-sm"
          aria-label={`Quelle zu: ${fact.label}`}
        >
          ⓘ
        </summary>
        <span
          role="note"
          className="mt-1 block rounded border p-2 text-sm"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--muted)" }}
        >
          {fact.label}.{" "}
          {fact.sources.map((s) => (
            <span key={s}>
              Quelle: {SOURCES[s].short} ({SOURCES[s].year}).{" "}
            </span>
          ))}
        </span>
      </details>
    </span>
  );
}
