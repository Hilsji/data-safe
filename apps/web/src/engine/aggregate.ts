/**
 * Anonymer Beitrag zur Klassen-Auswertung (docs/ARCHITEKTUR.md, 5.1 ClassAggregate).
 * Der Client schickt nur Bucket-Indizes, keine Rohwerte, keine Segmente und nie Politik.
 * Der Server prüft mit demselben Schema (strict), sodass zusätzliche Felder abgewiesen werden.
 */
import { z } from "zod";
import { CATEGORIES, DURATIONS, type Category } from "./types";
import type { BubbleProfile } from "./engagement";
import type { QuizScore } from "./quizScoring";

export const DASHBOARD_EXCLUDED: readonly Category[] = ["politics"];
export const DASHBOARD_CATEGORIES = CATEGORIES.filter((c) => !DASHBOARD_EXCLUDED.includes(c));

export const BUCKETS = {
  /** 10 Buckets à 10 %-Punkte; 100 % fällt in den letzten */
  pct: 10,
  /** d′ von −1 bis 4 in 0,5er-Schritten → 10 Buckets, geklemmt */
  dPrimeMin: -1,
  dPrimeStep: 0.5,
  dPrimeBuckets: 10,
  /** Videos: 0–19, 20–39, …, 200+ → 11 Buckets */
  videosStep: 20,
  videosBuckets: 11,
  /** Entropie-Abfall erstes → letztes Drittel, −0,5 … +0,5 in 0,1er-Schritten → 10 Buckets */
  entropyMin: -0.5,
  entropyStep: 0.1,
  entropyBuckets: 10,
} as const;

const clampIndex = (i: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(i)));

export const pctBucket = (share: number) => clampIndex(share * BUCKETS.pct, BUCKETS.pct);
export const dPrimeBucket = (d: number) => clampIndex((d - BUCKETS.dPrimeMin) / BUCKETS.dPrimeStep, BUCKETS.dPrimeBuckets);
export const videosBucket = (n: number) => clampIndex(n / BUCKETS.videosStep, BUCKETS.videosBuckets);
export const entropyDropBucket = (drop: number) =>
  clampIndex((drop - BUCKETS.entropyMin) / BUCKETS.entropyStep, BUCKETS.entropyBuckets);

export const contributionSchema = z
  .object({
    token: z.string().min(16).max(128),
    durationMin: z.union(DURATIONS.map((d) => z.literal(d)) as [z.ZodLiteral<15>, z.ZodLiteral<30>, z.ZodLiteral<45>]),
    contentCorrectBucket: z.number().int().min(0).max(BUCKETS.pct - 1).nullable(),
    recognitionDPrimeBucket: z.number().int().min(0).max(BUCKETS.dPrimeBuckets - 1).nullable(),
    videosSeenBucket: z.number().int().min(0).max(BUCKETS.videosBuckets - 1),
    prospectiveSuccess: z.boolean().nullable(),
    topCategory: z.enum(DASHBOARD_CATEGORIES as [Category, ...Category[]]).nullable(),
    entropyDropBucket: z.number().int().min(0).max(BUCKETS.entropyBuckets - 1),
  })
  .strict();

export type Contribution = z.infer<typeof contributionSchema>;

export function buildContribution(args: {
  token: string;
  durationMin: 15 | 30 | 45;
  score: QuizScore;
  bubble: BubbleProfile;
}): Contribution {
  const { score, bubble } = args;
  // Top-Kategorie ohne Politik: Ist Politik vorn, zählt die nächste Kategorie.
  const top = bubble.categories.find((c) => !DASHBOARD_EXCLUDED.includes(c.category))?.category ?? null;
  return contributionSchema.parse({
    token: args.token,
    durationMin: args.durationMin,
    contentCorrectBucket: score.content.share === null ? null : pctBucket(score.content.share),
    recognitionDPrimeBucket: score.recognition ? dPrimeBucket(score.recognition.dPrime) : null,
    videosSeenBucket: videosBucket(bubble.total),
    prospectiveSuccess: score.prospectiveSuccess,
    topCategory: top,
    entropyDropBucket: entropyDropBucket(bubble.entropyFirstThird - bubble.entropyLastThird),
  });
}

/** Mindestgröße einer Gruppe, bevor die Lehrkraft Ergebnisse sieht. */
export const MIN_GROUP_SIZE = 5;
