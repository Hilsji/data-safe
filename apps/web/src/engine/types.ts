/**
 * Gemeinsame Typen für Client und Server (siehe docs/ARCHITEKTUR.md, Abschnitt 5.3).
 * Die Worker-Pipeline (Python) erzeugt `AnalysisResult` im selben JSON-Format.
 */

export const DURATIONS = [15, 30, 45] as const;
export type DurationMin = (typeof DURATIONS)[number];

export const CATEGORIES = [
  "sport",
  "gaming",
  "comedy",
  "beauty_lifestyle",
  "luxury_hustle",
  "fitness",
  "news",
  "politics",
  "manosphere",
  "knowledge",
  "music_dance",
  "animals",
  "food",
  "relationships",
  "sexualized",
  "advertising",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SPECTRA = ["left", "center_left", "center", "center_right", "right", "unassignable"] as const;
export type Spectrum = (typeof SPECTRA)[number];

export const SOURCE_APPS = ["tiktok", "instagram_reels", "youtube_shorts", "snapchat_spotlight", "other"] as const;
export type SourceApp = (typeof SOURCE_APPS)[number];

export type Third = 1 | 2 | 3;

export interface ContentQuestion {
  id: string;
  type: "gist" | "detail";
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  evidence: { source: "transcript" | "onscreen_text" | "visual"; quote: string };
  /** Zweiter, unabhängiger Modelldurchlauf konnte die Frage allein aus dem Beleg beantworten. */
  verified: boolean;
}

export interface Segment {
  index: number;
  startSec: number;
  endSec: number;
  watchedSec: number;
  third: Third;
  kind: "video" | "photo_carousel" | "live" | "ad";
  skipped: boolean;
  /** null = nicht sicher erkennbar → fließt nicht in Scores ein */
  liked: boolean | null;
  replays: number | null;
  completed: boolean | null;
  category: Category;
  categoryConfidence: number;
  spectrum?: Spectrum;
  spectrumConfidence?: number;
  hasDog?: boolean;
  /** kleines, geschwärztes Standbild (data-URL) */
  keyframe?: string;
  summary: string;
  /** Kandidaten für Inhaltsfragen; die Auswahl trifft der Client (quizBuilder). */
  questions: ContentQuestion[];
}

export interface AnalysisResult {
  meta: {
    durationMin: DurationMin;
    app: SourceApp;
    analyzedSec: number;
    /** Sekunden außerhalb des Feeds (DM, Profil, fremde App …) – nur Dauer, kein Inhalt */
    offFeedSec: number;
    pipelineVersion: string;
    modelVersion: string;
    politicsSpectrumEnabled: boolean;
    recordingEndedAt: string;
    warnings: string[];
  };
  segments: Segment[];
}
