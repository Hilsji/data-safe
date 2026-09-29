/**
 * Kalibrierung & Freigabe der Politik-Richtung (Entscheidung E6).
 * - Nur Aufnahmen des Projektteams mit Test-Accounts – nie Schülerdaten.
 * - Rater taggen unabhängig und sehen weder die Tags der anderen noch die Einordnung des Modells.
 * - Freigabe gilt für genau eine Modellversion; ein neues Modell muss neu validiert werden.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { buildValidationReport, type ValidationReport, type ValidationSegment } from "@/engine/validation";
import { CATEGORIES, SOURCE_APPS, SPECTRA } from "@/engine/types";
import { ArenaError } from "./arena";
import type { CalibrationDoc, Store } from "./store";

export const calibrationUploadSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    app: z.enum(SOURCE_APPS),
    device: z.string().trim().max(60),
    modelVersion: z.string().min(1).max(120),
    pipelineVersion: z.string().min(1).max(40),
    segments: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          startSec: z.number().min(0),
          endSec: z.number().min(0),
          keyframe: z.string().startsWith("data:image/jpeg;base64,").max(200_000),
          model: z.object({
            category: z.enum(CATEGORIES),
            categoryConfidence: z.number().min(0).max(1),
            spectrum: z.enum(SPECTRA).optional(),
            liked: z.boolean().nullable(),
            replays: z.number().int().min(0).nullable(),
          }),
        }),
      )
      .min(1)
      .max(2000),
  })
  .strict();

export const tagSchema = z
  .object({
    segmentId: z.string().min(1).max(40),
    category: z.enum(CATEGORIES),
    spectrum: z.enum(SPECTRA).optional(),
    boundaryOk: z.boolean(),
    likeOk: z.boolean(),
    replayOk: z.boolean(),
  })
  .strict();

export interface CalDeps {
  store: Store;
  now?: () => Date;
}

export async function uploadCalibration(deps: CalDeps, userId: string, raw: unknown): Promise<string> {
  const input = calibrationUploadSchema.parse(raw);
  const doc: CalibrationDoc = { _id: randomUUID(), ...input, createdBy: userId, createdAt: (deps.now ?? (() => new Date()))() };
  await deps.store.insertCalibration(doc);
  return doc._id;
}

export async function listForRater(deps: CalDeps, raterId: string) {
  const [recs, tags] = await Promise.all([deps.store.listCalibrations(), deps.store.listRaterTags({ raterId })]);
  return Promise.all(
    recs.map(async (r) => {
      const full = await deps.store.getCalibration(r._id);
      return {
        id: r._id,
        title: r.title,
        app: r.app,
        modelVersion: r.modelVersion,
        segments: full?.segments.length ?? 0,
        taggedByMe: tags.filter((t) => t.recordingId === r._id).length,
      };
    }),
  );
}

/** Segmente für Rater: ohne Themen-/Richtungs-Einordnung des Modells (kein Anker-Effekt). */
export async function segmentsForRater(deps: CalDeps, raterId: string, recordingId: string) {
  const rec = await deps.store.getCalibration(recordingId);
  if (!rec) throw new ArenaError(404, "not_found", "Kalibrieraufnahme nicht gefunden.");
  const mine = await deps.store.listRaterTags({ recordingId, raterId });
  return {
    id: rec._id,
    title: rec.title,
    segments: rec.segments.map((s) => {
      const t = mine.find((x) => x.segmentId === s.id);
      return {
        id: s.id,
        startSec: s.startSec,
        endSec: s.endSec,
        keyframe: s.keyframe,
        detected: { liked: s.model.liked, replays: s.model.replays },
        myTag: t ? { category: t.category, spectrum: t.spectrum, boundaryOk: t.boundaryOk, likeOk: t.likeOk, replayOk: t.replayOk } : null,
      };
    }),
  };
}

export async function saveTag(deps: CalDeps, raterId: string, recordingId: string, raw: unknown): Promise<void> {
  const tag = tagSchema.parse(raw);
  const rec = await deps.store.getCalibration(recordingId);
  if (!rec || !rec.segments.some((s) => s.id === tag.segmentId)) throw new ArenaError(404, "not_found", "Segment nicht gefunden.");
  await deps.store.upsertRaterTag({
    _id: `${recordingId}:${tag.segmentId}:${raterId}`,
    recordingId,
    segmentId: tag.segmentId,
    raterId,
    category: tag.category,
    spectrum: tag.category === "politics" ? tag.spectrum : undefined,
    boundaryOk: tag.boundaryOk,
    likeOk: tag.likeOk,
    replayOk: tag.replayOk,
    taggedAt: (deps.now ?? (() => new Date()))(),
  });
}

export interface ModelReport {
  modelVersion: string | null;
  report: ValidationReport | null;
  approval: { approvedModelVersion: string | null; approvedAt: string | null };
}

/** Bericht für die neueste Modellversion (nach Upload-Datum). */
export async function validationReport(deps: CalDeps): Promise<ModelReport> {
  const recs = await deps.store.listCalibrations();
  const approval = await deps.store.getPoliticsApproval();
  const latest = [...recs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  const base = { approval: { approvedModelVersion: approval.approvedModelVersion, approvedAt: approval.approvedAt?.toISOString() ?? null } };
  if (!latest) return { modelVersion: null, report: null, ...base };
  const segments: ValidationSegment[] = [];
  for (const r of recs.filter((x) => x.modelVersion === latest.modelVersion)) {
    const full = await deps.store.getCalibration(r._id);
    const tags = await deps.store.listRaterTags({ recordingId: r._id });
    for (const s of full?.segments ?? []) {
      segments.push({
        id: `${r._id}:${s.id}`,
        model: { category: s.model.category, spectrum: s.model.spectrum },
        tags: tags
          .filter((t) => t.segmentId === s.id)
          .sort((a, b) => a.raterId.localeCompare(b.raterId))
          .map((t) => ({ raterId: t.raterId, category: t.category, spectrum: t.spectrum, boundaryOk: t.boundaryOk, likeOk: t.likeOk, replayOk: t.replayOk })),
      });
    }
  }
  return { modelVersion: latest.modelVersion, report: buildValidationReport(segments), ...base };
}

export async function approvePolitics(deps: CalDeps, adminId: string): Promise<string> {
  const { modelVersion, report } = await validationReport(deps);
  if (!modelVersion || !report) throw new ArenaError(409, "no_data", "Keine Kalibrierdaten.");
  if (!report.politicsApprovable) throw new ArenaError(409, "thresholds", "Die Schwellen aus E6 sind nicht erfüllt.", { reasons: report.reasons });
  await deps.store.setPoliticsApproval({ _id: "politics", approvedModelVersion: modelVersion, approvedAt: (deps.now ?? (() => new Date()))(), approvedBy: adminId });
  return modelVersion;
}

export async function revokePolitics(deps: CalDeps): Promise<void> {
  await deps.store.setPoliticsApproval({ _id: "politics", approvedModelVersion: null, approvedAt: null, approvedBy: null });
}
