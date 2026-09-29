import type { AnalysisResult, Category, ContentQuestion, Segment, Spectrum, Third } from "@/engine/types";

let qCounter = 0;

export function question(type: ContentQuestion["type"] = "detail", verified = true): ContentQuestion {
  qCounter++;
  return {
    id: `q${qCounter}`,
    type,
    question: `Frage ${qCounter}?`,
    options: ["A", "B", "C", "D"],
    correctIndex: 1,
    evidence: { source: "transcript", quote: "Beleg" },
    verified,
  };
}

export function segment(index: number, overrides: Partial<Segment> = {}): Segment {
  const startSec = index * 20;
  return {
    index,
    startSec,
    endSec: startSec + 15,
    watchedSec: 15,
    third: 1,
    kind: "video",
    skipped: false,
    liked: false,
    replays: 0,
    completed: false,
    category: "comedy",
    categoryConfidence: 0.9,
    keyframe: `data:image/jpeg;base64,seg${index}`,
    summary: `Segment ${index}`,
    questions: [question("gist"), question("detail")],
    ...overrides,
  };
}

/** n Segmente, gleichmäßig auf drei Drittel verteilt, Kategorien reihum. */
export function session(n: number, categories: Category[] = ["comedy", "sport", "gaming"]): Segment[] {
  return Array.from({ length: n }, (_, i) =>
    segment(i, { third: (Math.floor((i * 3) / n) + 1) as Third, category: categories[i % categories.length]! }),
  );
}

export function result(segments: Segment[], politicsSpectrumEnabled = true): AnalysisResult {
  return {
    meta: {
      durationMin: 15,
      app: "tiktok",
      analyzedSec: 900,
      offFeedSec: 0,
      pipelineVersion: "test",
      modelVersion: "test",
      politicsSpectrumEnabled,
      recordingEndedAt: "2026-09-29T10:00:00Z",
      warnings: [],
    },
    segments,
  };
}

export function politicsSegment(index: number, spectrum: Spectrum, watchedSec: number, confidence = 0.9): Segment {
  return segment(index, { category: "politics", spectrum, spectrumConfidence: confidence, watchedSec });
}
