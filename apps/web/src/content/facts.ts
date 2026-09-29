/**
 * Zahlen-Registry: Jede Zahl, die die App zeigt, steht hier – mit Quelle.
 * Die UI rendert Zahlen ausschließlich über <Fact id="…"/> (ⓘ zeigt Quelle + Jahr).
 * IDs D01–D20 entsprechen Anhang A des Arbeitspapiers.
 *
 * status:
 *  - "verified": steht so im Arbeitspapier bzw. wurde geprüft
 *  - "check":    wird angezeigt, ist aber vor dem Schuleinsatz fachlich zu prüfen (siehe `note`)
 *  - "todo":     wird NICHT angezeigt
 */
import type { SourceId } from "./sources";

export interface Fact {
  id: string;
  label: string;
  value: string;
  sources: SourceId[];
  status: "verified" | "check" | "todo";
  note?: string;
  /** Werte für Diagramme – dieselben Zahlen wie in `value`, nie zusätzliche */
  numbers?: readonly number[];
  /** Beschriftung je Diagramm-Wert */
  numberLabels?: readonly string[];
  unit?: string;
}

export const FACTS = {
  D01: {
    id: "D01",
    label: "Smartphone-Bildschirmzeit pro Tag, 12–13 J. bzw. 18–19 J.",
    value: "166 min bzw. 278 min",
    numbers: [166, 278],
    unit: "min",
    numberLabels: ["12–13 Jahre", "18–19 Jahre"],
    sources: ["jim2025"],
    status: "check",
    note: "Arbeitspapier: im Text „Volljährige“, in Anhang A „18–19 J.“ – Altersangabe angleichen.",
  },
  D02: {
    id: "D02",
    label: "Riskante / pathologische Social-Media-Nutzung, 10–17 J.",
    value: "21,5 % / 6,6 %",
    numbers: [21.5, 6.6],
    unit: "%",
    numberLabels: ["riskant", "pathologisch"],
    sources: ["dak2026"],
    status: "verified",
  },
  D03: {
    id: "D03",
    label: "Online-Videos/Reels: riskante Nutzung / Suchtkriterien",
    value: "ca. 20 % / 4 %",
    sources: ["dak2026"],
    status: "verified",
  },
  D04: {
    id: "D04",
    label: "Problematische Social-Media-Nutzung (HBSC 2022), gesamt (Mädchen / Jungen)",
    value: "11 % (13 % / 9 %)",
    sources: ["hbsc2024"],
    status: "verified",
  },
  D05: {
    id: "D05",
    label: "Riskantes Video-Streaming 2025, 10–17 J.",
    value: "25 %",
    sources: ["cloes2026"],
    status: "check",
    note: "Nicht begutachteter Preprint – in der App als Preprint kennzeichnen.",
  },
  D06: {
    id: "D06",
    label: "Test-Accounts von Jungen: Zeit bis zu toxischen / Manosphere-Inhalten",
    value: "≤ 23 min / ≤ 26 min",
    numbers: [23, 26],
    unit: "min",
    numberLabels: ["toxische Inhalte", "Manosphere"],
    sources: ["dcu2024"],
    status: "check",
    note: "Arbeitspapier nennt die 23 min in der Zusammenfassung „misogyn“, in Tab. 5 „toxisch“. App verwendet „toxisch“.",
  },
  D07: {
    id: "D07",
    label: "Anteil toxischer Inhalte: YouTube Shorts / TikTok",
    value: "61,5 % / 34,7 %",
    sources: ["dcu2024"],
    status: "verified",
  },
  D08: {
    id: "D08",
    label: "Instagram Reels, Test-Accounts mit Alter 13: Zeit bis zu sexualisierten Inhalten",
    value: "teils 3 min; Feed voll nach < 20 min",
    sources: ["wsj2024"],
    status: "verified",
  },
  D09: {
    id: "D09",
    label: "Anteil belastender Videos nach 5–6 h (Test-Accounts, 13 J.)",
    value: "fast 50 % (ca. 10-fach)",
    sources: ["amnesty2023"],
    status: "verified",
  },
  D10: {
    id: "D10",
    label: "Zeit, bis Parteivideos im TikTok-Feed auftauchen (Test-Accounts, 21–25 J.)",
    value: "11–12 min",
    numbers: [11, 12],
    unit: "min",
    numberLabels: ["Parteivideos (von–bis)", ""],
    sources: ["potsdam2025"],
    status: "check",
    note: "Im Papier auf #afd bezogen. In der App neutral („Parteien an den Rändern häufiger ausgespielt“) – Beutelsbacher Konsens prüfen.",
  },
  D16: {
    id: "D16",
    label: "YouTube-Seitenleiste: Zeit, bis Empfehlungen sich nach Verhaltenswechsel anpassen",
    value: "ca. 30 Videos",
    sources: ["hosseinmardi2024"],
    status: "verified",
  },
  D17: {
    id: "D17",
    label: "Algorithmus ein- vs. ausschalten (X, 4.965 Personen, 7 Wochen)",
    value: "Einschalten verschob Einstellungen, Ausschalten machte nichts rückgängig",
    sources: ["gauthier2026"],
    status: "verified",
  },
  D18: {
    id: "D18",
    label: "Veränderung der Feindseligkeit durch Umsortieren des Feeds",
    value: "ca. 2 Punkte (Skala 0–100)",
    sources: ["piccardi2025"],
    status: "verified",
  },
  N01: {
    id: "N01",
    label: "Metaanalyse Kurzvideo-Nutzung: Zusammenhang mit Aufmerksamkeit / Impulskontrolle",
    value: "r = −0,38 / r = −0,41 (71 Studien, 98.299 Personen, korrelativ)",
    sources: ["nguyen2025"],
    status: "verified",
  },
  EU01: {
    id: "EU01",
    label: "EU-Kommission: vorläufige Feststellung zu TikTok (Digital Services Act)",
    value: "Endlos-Scrollen, Autoplay, Push-Nachrichten und personalisierte Empfehlungen versetzen in einen „Autopilot-Modus“ – vorläufig, TikTok widerspricht",
    sources: ["euCommission2026"],
    status: "verified",
  },
  N02: {
    id: "N02",
    label: "Zwei Wochen ohne mobiles Internet",
    value: "bessere Daueraufmerksamkeit, psychische Gesundheit und Wohlbefinden",
    sources: ["castelo2025"],
    status: "verified",
  },
} as const satisfies Record<string, Fact>;

export type FactId = keyof typeof FACTS;
