import { beforeEach, describe, expect, it } from "vitest";
import { ArenaError } from "./arena";
import { approvePolitics, revokePolitics, saveTag, segmentsForRater, uploadCalibration, validationReport } from "./calibration";
import { MemoryStore } from "./store";
import { RATED_SPECTRA } from "@/engine/validation";

const JPEG = "data:image/jpeg;base64,/9j/";
let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
});

function upload(perSpectrum: number, modelVersion = "m1") {
  const segments = RATED_SPECTRA.flatMap((sp, j) =>
    Array.from({ length: perSpectrum }, (_, i) => ({
      id: `${j}-${i}`,
      startSec: i,
      endSec: i + 1,
      keyframe: JPEG,
      model: { category: "politics" as const, categoryConfidence: 0.9, spectrum: sp, liked: false, replays: 0 },
    })),
  );
  return uploadCalibration({ store }, "admin", { title: "Kalibrierung 1", app: "tiktok", device: "iPad 9", modelVersion, pipelineVersion: "0.1.0", segments });
}

async function tagAll(recId: string, rater: string) {
  const rec = await store.getCalibration(recId);
  for (const s of rec!.segments) {
    await saveTag({ store }, rater, recId, { segmentId: s.id, category: "politics", spectrum: s.model.spectrum, boundaryOk: true, likeOk: true, replayOk: true });
  }
}

describe("Kalibrierung", () => {
  it("zeigt Ratern keine Themen-Einordnung des Modells", async () => {
    const id = await upload(1);
    const view = await segmentsForRater({ store }, "r1", id);
    const json = JSON.stringify(view);
    expect(json).not.toContain("politics");
    expect(json).not.toContain("spectrum");
    expect(view.segments[0]!.detected).toEqual({ liked: false, replays: 0 });
  });

  it("Rater sehen nur ihre eigenen Tags", async () => {
    const id = await upload(1);
    await tagAll(id, "r1");
    const other = await segmentsForRater({ store }, "r2", id);
    expect(other.segments.every((s) => s.myTag === null)).toBe(true);
  });

  it("gibt die Politik-Richtung erst frei, wenn E6 erfüllt ist – und nur für diese Modellversion", async () => {
    const id = await upload(12);
    await tagAll(id, "r1");
    await expect(approvePolitics({ store }, "admin")).rejects.toSatisfy((e: unknown) => e instanceof ArenaError && e.code === "thresholds");
    await tagAll(id, "r2");
    const rep = await validationReport({ store });
    expect(rep.report!.politicsApprovable).toBe(true);
    expect(await approvePolitics({ store }, "admin")).toBe("m1");
    expect((await store.getPoliticsApproval()).approvedModelVersion).toBe("m1");

    // neues Modell hochgeladen → Bericht bezieht sich auf m2, Freigabe von m1 bleibt, gilt aber nicht für m2
    await new Promise((r) => setTimeout(r, 5));
    await upload(2, "m2");
    const rep2 = await validationReport({ store });
    expect(rep2.modelVersion).toBe("m2");
    expect(rep2.report!.politicsApprovable).toBe(false);

    await revokePolitics({ store });
    expect((await store.getPoliticsApproval()).approvedModelVersion).toBeNull();
  });

  it("verwirft Spektrum bei Nicht-Politik-Tags und prüft das Segment", async () => {
    const id = await upload(1);
    const segId = (await store.getCalibration(id))!.segments[0]!.id;
    await saveTag({ store }, "r1", id, { segmentId: segId, category: "sport", spectrum: "left", boundaryOk: true, likeOk: true, replayOk: false });
    expect((await store.listRaterTags({ raterId: "r1" }))[0]!.spectrum).toBeUndefined();
    await expect(saveTag({ store }, "r1", id, { segmentId: "gibt-es-nicht", category: "sport", boundaryOk: true, likeOk: true, replayOk: true })).rejects.toThrow();
  });
});
