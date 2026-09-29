import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test("unter 14: kein Scroll-Test, Verweis auf die Module", async ({ page }) => {
  await page.goto("/arena");
  await page.getByLabel("unter 14").check();
  await expect(page.getByText("Der Scroll-Test ist ab 14 Jahren")).toBeVisible();
  await expect(page.getByRole("button", { name: "Weiter" })).toHaveCount(0);
});

test("unter 16 braucht den Klassen-Code", async ({ page }) => {
  await page.goto("/arena");
  await page.getByLabel("14 oder 15").check();
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByLabel(/Ich bin einverstanden/).check();
  await expect(page.getByRole("button", { name: "Weiter" })).toBeDisabled();
});

test("kompletter Ablauf bis zum Upload (16+)", async ({ page }) => {
  await page.goto("/arena");
  await axe(page);
  await page.getByLabel("16 oder älter").check();
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByRole("heading", { name: "Was mit deinen Daten passiert" })).toBeFocused();
  await axe(page);
  await page.getByLabel(/Ich bin einverstanden/).check();
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByRole("heading", { name: "Deine persönliche ID" })).toBeVisible();
  const displayId = (await page.locator("p.font-mono").first().textContent())!.trim();
  expect(displayId).toMatch(/^([0-9A-Z]{4}-){6}[0-9A-Z]{2}$/);
  await axe(page);
  await page.getByLabel("Ich habe meine ID notiert.").check();
  await page.getByRole("button", { name: "Weiter" }).click();

  // Baseline: 8 Wörter × 3 s, dann 16 Ja/Nein
  await page.getByRole("button", { name: "Los geht’s" }).click();
  await expect(page.getByText("War dieses Wort dabei?")).toBeVisible({ timeout: 40_000 });
  for (let i = 0; i < 16; i++) await page.getByRole("button", { name: i % 2 ? "Ja" : "Nein" }).click();

  await expect(page.getByText("Dein Ausgangswert ist gespeichert.")).toBeVisible();
  await page.getByLabel("15 Minuten").check();
  await page.getByLabel("TikTok").check();
  await page.getByLabel("Ich habe mir das Wort gemerkt.").check();
  await axe(page);
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByRole("heading", { name: "So startest du die Aufnahme" })).toBeVisible();
  await page.getByRole("tab", { name: "iPad / iPhone" }).click();
  await expect(page.getByText("Kontrollzentrum").first()).toBeVisible();
  await axe(page);

  // Merkaufgabe: Stern als erste Aktion
  await page.getByRole("button", { name: "Stern" }).click();
  await page.getByLabel("Welches Wort solltest du dir merken?").fill("Leuchtturm");
  await page.getByRole("button", { name: "Speichern" }).click();

  await page.getByRole("button", { name: "Ich bin zurück" }).click();
  await expect(page.getByRole("heading", { name: "Aufnahme hochladen" })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "aufnahme.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(20_000, 7) });
  await expect(page.getByText(/wird jetzt ausgewertet/)).toBeVisible();
  await expect(page.getByText(displayId)).toBeVisible();
  await axe(page);
});
