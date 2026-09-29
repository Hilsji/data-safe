import { describe, expect, it } from "vitest";
import { groupStats } from "./classStats";

const empty = () => ({
  n: 0,
  contentCorrectHist: Array(10).fill(0),
  recognitionDPrimeHist: Array(10).fill(0),
  videosSeenHist: Array(11).fill(0),
  prospectiveSuccess: 0,
  prospectiveTotal: 0,
  topCategoryCounts: {},
  entropyDropHist: Array(10).fill(0),
});

describe("groupStats", () => {
  it("berechnet Mittelwerte über Bucket-Mitten", () => {
    const g = empty();
    g.n = 4;
    g.contentCorrectHist[5] = 2; // 50–60 % → 0,55
    g.contentCorrectHist[7] = 2; // 70–80 % → 0,75
    g.recognitionDPrimeHist[4] = 4; // 1,0–1,5 → 1,25
    g.videosSeenHist[1] = 4; // 20–39 → 30
    g.prospectiveSuccess = 1;
    g.prospectiveTotal = 4;
    g.entropyDropHist[7] = 4; // 0,2–0,3 → 0,25
    g.topCategoryCounts = { food: 1, gaming: 3 };
    const s = groupStats(g);
    expect(s.contentCorrectMean).toBeCloseTo(0.65, 10);
    expect(s.dPrimeMean).toBeCloseTo(1.25, 10);
    expect(s.videosSeenMean).toBe(30);
    expect(s.prospectiveRate).toBe(0.25);
    expect(s.entropyDropMean).toBeCloseTo(0.25, 10);
    expect(s.topCategories.map((c) => c.category)).toEqual(["gaming", "food"]);
  });

  it("offener letzter Videos-Bucket nutzt die Untergrenze", () => {
    const g = empty();
    g.videosSeenHist[10] = 1;
    expect(groupStats(g).videosSeenMean).toBe(200);
  });

  it("liefert null ohne Daten", () => {
    const s = groupStats(empty());
    expect(s.contentCorrectMean).toBeNull();
    expect(s.prospectiveRate).toBeNull();
  });
});
