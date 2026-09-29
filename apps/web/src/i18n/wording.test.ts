import { describe, expect, it } from "vitest";
import { de } from "./de";

function allStrings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => allStrings(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => allStrings(v, path ? `${path}.${k}` : k));
  return [];
}

/** Arbeitspapier Kap. 12.1/12.4: keine Diagnosen, keine Beschämung, keine Gesinnungszuschreibung. */
const FORBIDDEN = [
  /diagnos/i,
  /beschädigt/i,
  /süchtig/i,
  /\bsucht\b/i,
  /krank/i,
  /gestört/i,
  /dumm/i,
  /versag/i,
  /schäm/i,
  /du bist (links|rechts|mitte)/i,
  /dein gedächtnis ist/i,
];

describe("Wording-Pflicht", () => {
  const strings = allStrings(de);

  it("hat Texte", () => expect(strings.length).toBeGreaterThan(50));

  it.each(strings)("%s ist frei von verbotenen Formulierungen", (_path, text) => {
    for (const re of FORBIDDEN) expect(text).not.toMatch(re);
  });

  it("enthält keine Ziffern in Fließtexten außer Zeit-/Alters-/Datenschutzangaben (Zahlen laufen über <Fact>)", () => {
    const allowed = /^(15|30|45|5|7|8|13|14|16|2|3|9|6)$/;
    for (const [path, text] of strings) {
      // Gesetzesverweise („Art. 38“) sind keine Statistiken
      const withoutLaw = text.replace(/Art\. \d+/g, "");
      for (const n of withoutLaw.match(/\d+/g) ?? []) {
        expect(allowed.test(n), `${path}: „${n}“ – Zahl ohne Quelle? Über <Fact> einbinden`).toBe(true);
      }
    }
  });
});
