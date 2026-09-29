import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createIdentity } from "../../src/crypto/uniqueId";
import { encryptJson, toB64 } from "../../src/crypto/ecies";
import type { AnalysisResult, Category, Segment } from "../../src/engine/types";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

function seg(i: number, category: Category, third: 1 | 2 | 3, extra: Partial<Segment> = {}): Segment {
  return {
    index: i, startSec: i * 20, endSec: i * 20 + 15, watchedSec: 15, third, kind: "video", skipped: false, liked: false,
    replays: 0, completed: null, category, categoryConfidence: 0.9, keyframe: JPEG, summary: `Video ${i}`,
    questions: [
      { id: `s${i}g`, type: "gist", question: `Worum ging es in Video ${i}?`, options: [`Thema ${i}`, "Kochen", "Fußball", "Mathe"], correctIndex: 0, evidence: { source: "onscreen_text", quote: `Thema ${i}` }, verified: true },
      { id: `s${i}d`, type: "detail", question: `Welche Zahl kam in Video ${i} vor?`, options: ["1", "2", "3", "4"], correctIndex: 2, evidence: { source: "transcript", quote: "drei" }, verified: true },
    ],
    ...extra,
  };
}

function result(): AnalysisResult {
  const cats: Category[] = ["comedy", "sport", "food", "gaming", "knowledge", "animals"];
  const segments: Segment[] = [];
  for (let i = 0; i < 45; i++) {
    const third = (Math.floor(i / 15) + 1) as 1 | 2 | 3;
    // Verengung: am Ende fast nur noch Fitness und Politik
    const category = third === 3 ? (i % 2 ? "fitness" : "politics") : cats[i % cats.length]!;
    segments.push(seg(i, category, third, category === "politics" ? { spectrum: "center_left", spectrumConfidence: 0.9, watchedSec: 30 } : {}));
  }
  return {
    meta: { durationMin: 15, app: "tiktok", analyzedSec: 900, offFeedSec: 120, pipelineVersion: "e2e", modelVersion: "e2e", politicsSpectrumEnabled: true, recordingEndedAt: new Date(Date.now() - 3 * 3600_000).toISOString(), warnings: [] },
    segments,
  };
}

test("Bericht abrufen, Quiz, Feed-Bericht, Löschen", async ({ page, request }) => {
  const id = createIdentity();
  const clientState = { v: 1, createdAt: new Date().toISOString(), durationMin: 15, app: "tiktok", baseline: { dPrime: 1.2, hitRate: 0.75, falseAlarmRate: 0.25 }, prospective: { kind: "word_at_end", word: "Kaktus", result: { tappedStarFirst: true, answer: "kaktus", correct: true } } };
  const r = await request.post("/api/test/seed-report", {
    data: { retrievalId: id.retrievalId, publicKey: toB64(id.publicKey), result: await encryptJson(result(), id.publicKey), clientState: await encryptJson(clientState, id.publicKey) },
  });
  expect(r.ok()).toBe(true);

  await page.goto("/bericht");
  await page.getByLabel("Gib deine ID ein").fill(id.displayId.toLowerCase().replace(/-/g, " "));
  await page.getByRole("button", { name: "Bericht abrufen" }).click();

  await expect(page.getByRole("button", { name: "Quiz starten" })).toBeVisible();
  await expect(page.getByText(/nur eingeschränkt mit anderen Runden vergleichbar/)).toBeVisible(); // Ablenker-Bank noch leer
  await page.getByRole("button", { name: "Quiz starten" }).click();

  for (let i = 0; i < 9; i++) {
    await expect(page.getByText(`Frage ${i + 1} von 9`)).toBeVisible();
    const q = (await page.getByRole("heading", { level: 2 }).textContent())!;
    if (q.startsWith("Worum")) await page.getByRole("button", { name: /^Thema / }).click();
    else await page.getByRole("button", { name: "3", exact: true }).click();
  }

  await expect(page.getByRole("heading", { name: "In welcher Reihenfolge kamen diese Videos?" })).toBeVisible();
  const selects = page.locator("select");
  for (let i = 0; i < 3; i++) await selects.nth(i).selectOption(String(i));
  await page.getByRole("button", { name: "Auswerten" }).click();

  await expect(page.getByRole("heading", { name: "Was bleibt von deiner Runde?" })).toBeVisible();
  await expect(page.getByText("100 %").first()).toBeVisible();
  await expect(page.getByText("Die Aufgabe mit dem Stern hast du erledigt.")).toBeVisible();
  await expect(page.getByText(/Zwischen Scrollen und Quiz lagen bei dir 3,0 Stunden/)).toBeVisible();
  await expect(page.getByText("Vom Anfang zum Ende ist die Themenvielfalt in deinem Feed gesunken.")).toBeVisible();
  await expect(page.getByText(/in Richtung Politik-Inhalte der linken Mitte verengt/)).toBeVisible();
  await expect(page.getByText("Das beschreibt deinen Feed, nicht deine Meinung.", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Als Tabelle anzeigen" }).click();
  await expect(page.getByRole("rowheader", { name: "Fitness" })).toBeVisible();
  await page.getByRole("button", { name: "Blase platzen lassen" }).click();
  await expect(page.getByText(/Entfolgen/)).toBeVisible();

  await page.getByLabel("Wie viele Minuten scrollst du an einem normalen Tag?").fill("120");
  await expect(page.getByText(/Videos und 14,0 Stunden pro Woche/)).toBeVisible();

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);

  // Optional für die Sichtprüfung: SCREENSHOT_DIR=… npx playwright test
  if (process.env.SCREENSHOT_DIR) {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/bericht-hell.png`, fullPage: true });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/bericht-dunkel.png`, fullPage: true });
    await page.emulateMedia({ colorScheme: "light" });
  }

  await page.getByRole("button", { name: "Bericht und alle Daten jetzt löschen" }).click();
  await expect(page.getByText("Gelöscht.")).toBeVisible();
  expect((await request.get(`/api/arena/${id.retrievalId}`)).status()).toBe(404);
});

test("Testroute ist ohne Freigabe gesperrt", async () => {
  // Prüft die Schutzbedingung im Code statt über den laufenden Server (der hat die Freigabe gesetzt)
  const src = await import("node:fs").then((fs) => fs.readFileSync("src/app/api/test/seed-report/route.ts", "utf8"));
  expect(src).toContain('process.env.ENABLE_TEST_ROUTES !== "1" || process.env.NODE_ENV === "production"');
});
