/** Prüft den entschlüsselten Bericht, bevor die App ihn verwendet (Schutz vor defekten oder fremden Daten). */
import { z } from "zod";
import { CATEGORIES, DURATIONS, SOURCE_APPS, SPECTRA, type AnalysisResult } from "./types";

const question = z.object({
  id: z.string(),
  type: z.enum(["gist", "detail"]),
  question: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  evidence: z.object({ source: z.enum(["transcript", "onscreen_text", "visual"]), quote: z.string() }),
  verified: z.boolean(),
});

const segment = z.object({
  index: z.number().int().min(0),
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  watchedSec: z.number().min(0),
  third: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  kind: z.enum(["video", "photo_carousel", "live", "ad"]),
  skipped: z.boolean(),
  liked: z.boolean().nullable(),
  replays: z.number().int().min(0).nullable(),
  completed: z.boolean().nullable(),
  category: z.enum(CATEGORIES),
  categoryConfidence: z.number().min(0).max(1),
  spectrum: z.enum(SPECTRA).optional(),
  spectrumConfidence: z.number().min(0).max(1).optional(),
  hasDog: z.boolean().optional(),
  keyframe: z.string().startsWith("data:image/jpeg;base64,").optional(),
  summary: z.string(),
  questions: z.array(question),
});

export const analysisResultSchema = z.object({
  meta: z.object({
    durationMin: z.union(DURATIONS.map((d) => z.literal(d)) as [z.ZodLiteral<15>, z.ZodLiteral<30>, z.ZodLiteral<45>]),
    app: z.enum(SOURCE_APPS),
    analyzedSec: z.number().min(0),
    offFeedSec: z.number().min(0),
    pipelineVersion: z.string(),
    modelVersion: z.string(),
    politicsSpectrumEnabled: z.boolean(),
    recordingEndedAt: z.string(),
    warnings: z.array(z.string()),
  }),
  segments: z.array(segment),
});

export function parseAnalysisResult(value: unknown): AnalysisResult {
  return analysisResultSchema.parse(value) as AnalysisResult;
}
