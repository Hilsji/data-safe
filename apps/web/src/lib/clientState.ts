import type { DurationMin, SourceApp } from "@/engine/types";

/** Was der Client für die Auswertung in der Folgestunde braucht. Liegt nur verschlüsselt auf dem Server. */
export interface ClientState {
  v: 1;
  createdAt: string;
  durationMin: DurationMin;
  app: SourceApp;
  baseline: { dPrime: number; hitRate: number; falseAlarmRate: number } | null;
  prospective: {
    kind: "word_at_end";
    word: string;
    /** null = noch nicht zurückgekehrt */
    result: null | { tappedStarFirst: boolean; answer: string; correct: boolean };
  };
}

/** Wörter für die Merkaufgabe – bewusst NICHT aus der Baseline-Liste. */
export const INTENTION_WORDS_DE = ["Leuchtturm", "Kaktus", "Regenschirm", "Schildkröte", "Trompete", "Fallschirm", "Seestern", "Windmühle"] as const;

export function normalizeAnswer(s: string): string {
  return s.trim().toLocaleLowerCase("de-DE").replace(/\s+/g, "");
}
