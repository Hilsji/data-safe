import { describe, expect, it } from "vitest";
import { FACTS } from "./facts";
import { SOURCES } from "./sources";
import { EQUIVALENTS } from "./equivalents";

describe("Zahlen-Registry: jede Zahl mit Quelle", () => {
  it.each(Object.values(FACTS))("$id hat mindestens eine existierende Quelle", (fact) => {
    expect(fact.sources.length).toBeGreaterThan(0);
    for (const s of fact.sources) expect(SOURCES).toHaveProperty(s);
  });

  it.each(Object.values(FACTS))("$id: Fakten mit Status „check“ erklären, was zu prüfen ist", (fact) => {
    if (fact.status === "check") expect("note" in fact && fact.note.length > 10).toBe(true);
  });

  it("jede Quelle hat Jahr und Zitat; Quellen außerhalb des Arbeitspapiers sind gekennzeichnet", () => {
    for (const s of Object.values(SOURCES)) {
      expect(s.year).toBeGreaterThan(1900);
      expect(s.citation.length).toBeGreaterThan(20);
      if (!s.inPaper) expect("verifiedVia" in s || s.citation.startsWith("TODO")).toBe(true);
    }
  });

  it("Äquivalente ohne Quelle haben keinen Zahlenwert (nichts wird geschätzt)", () => {
    for (const e of EQUIVALENTS) {
      if (e.status !== "verified") expect(e.hours).toBeNull();
      else expect(e.source).not.toBeNull();
    }
  });
});
