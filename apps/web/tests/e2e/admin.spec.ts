import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SPECTRA = ["left", "center_left", "center", "center_right", "right"] as const;
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

function calibrationJson() {
  return {
    title: "Kalibrierung iPad TikTok",
    app: "tiktok",
    device: "iPad 9",
    modelVersion: "e2e-modell",
    pipelineVersion: "0.1.0",
    segments: SPECTRA.flatMap((sp, j) =>
      Array.from({ length: 10 }, (_, i) => ({
        id: `${sp}-${i}`,
        startSec: j * 100 + i * 10,
        endSec: j * 100 + i * 10 + 8,
        keyframe: JPEG,
        model: { category: "politics", categoryConfidence: 0.9, spectrum: sp, liked: false, replays: 0 },
      })),
    ),
  };
}

async function login(page: Page, request: APIRequestContext, email: string) {
  await page.goto("/lehrkraft");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByRole("button", { name: "Link schicken" }).click();
  await expect(page.getByText(/Wenn deine Adresse freigeschaltet ist/)).toBeVisible();
  const mail = (await (await request.get("/api/test/last-mail")).json()).text as string;
  await page.goto(mail.match(/https?:\/\/\S+token=\S+/)![0]);
}

async function tagAll(ctx: BrowserContext, recordingId: string) {
  for (const sp of SPECTRA) {
    for (let i = 0; i < 10; i++) {
      const r = await ctx.request.put(`/api/admin/calibration/${recordingId}/tag`, {
        data: { segmentId: `${sp}-${i}`, category: "politics", spectrum: sp, boundaryOk: true, likeOk: true, replayOk: i !== 0 },
      });
      expect(r.status()).toBe(204);
    }
  }
}

test("Kalibrierung: Upload, unabhängiges Tagging, Bericht, Freigabe", async ({ browser, request }) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, request, "admin@projekt.example");
  // Admin ist auch Lehrkraft → landet im Dashboard
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { name: "Kalibrierung & Freigabe" })).toBeVisible();
  await expect(admin.getByText(/Politik-Richtung ist nicht freigegeben/)).toBeVisible();

  await admin.getByLabel("Kalibrieraufnahme hochladen").setInputFiles({ name: "k.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(calibrationJson())) });
  await expect(admin.getByText("Hochgeladen.")).toBeVisible();
  const list = await (await adminCtx.request.get("/api/admin/calibration")).json();
  const recId = list[0].id as string;

  // Rater-Ansicht verrät die Modell-Einordnung nicht
  const view = await (await adminCtx.request.get(`/api/admin/calibration/${recId}`)).text();
  expect(view).not.toContain("politics");

  // ein Rater allein reicht nicht
  await tagAll(adminCtx, recId);
  await admin.reload();
  await expect(admin.getByText(/Freigabe nicht möglich/)).toBeVisible();
  await expect(admin.getByRole("button", { name: /freigeben/ })).toBeDisabled();

  // zweiter, unabhängiger Rater
  const raterCtx = await browser.newContext();
  const rater = await raterCtx.newPage();
  await login(rater, request, "rater@projekt.example");
  await expect(rater).toHaveURL(/\/admin$/);
  await expect(rater.getByText("Kalibrierung iPad TikTok")).toBeVisible();
  await expect(rater.getByText("Kalibrieraufnahme hochladen")).toHaveCount(0);
  await expect(rater.getByText("Validierungsbericht")).toHaveCount(0);
  expect((await raterCtx.request.get("/api/admin/validation")).status()).toBe(403);
  await rater.getByRole("button", { name: "Taggen" }).click();
  await expect(rater.getByText("Video 1 ·")).toBeVisible();
  const a = await new AxeBuilder({ page: rater }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a.violations.map((v) => v.id)).toEqual([]);
  await tagAll(raterCtx, recId);

  await admin.reload();
  await expect(admin.getByText("Alle Schwellen erfüllt – Freigabe möglich.")).toBeVisible();
  await admin.getByRole("button", { name: "Politik-Richtung für diese Modellversion freigeben" }).click();
  await expect(admin.getByText("Freigegeben für: e2e-modell")).toBeVisible();
  await admin.getByRole("button", { name: "Freigabe zurückziehen" }).click();
  await expect(admin.getByText(/Politik-Richtung ist nicht freigegeben/)).toBeVisible();
});

test("Admin-API ohne Anmeldung gesperrt", async ({ request }) => {
  expect((await request.get("/api/admin/calibration")).status()).toBe(401);
  expect((await request.post("/api/admin/validation/approve")).status()).toBe(401);
});
