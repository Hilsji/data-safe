import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test("Startseite verlinkt alle Module", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Was Social Media mit dir macht", "Die Vergleichs-Falle", "Scroll-Arena", "Dein Feed-Bericht"]) {
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  await axe(page);
});

test("Modul 1: acht Karten, Navigation per Button und Taste, Quelle per ⓘ", async ({ page }) => {
  await page.goto("/wissen");
  await expect(page.locator("article")).toHaveCount(8);
  await expect(page.getByText("Karte 1 von 8", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Quelle zu: Smartphone-Bildschirmzeit" }).first().click();
  await expect(page.getByRole("note").first()).toContainText("JIM-Studie 2025 (mpfs) (2025)");
  await axe(page);
  await page.getByRole("button", { name: "Nächste Karte" }).click();
  await page.getByRole("button", { name: "Nächste Karte" }).click();
  await expect(page.locator("p[aria-live]")).toHaveText("Karte 3 von 8");
  await expect(page.getByRole("heading", { name: "Blasen entstehen in Minuten" })).toBeInViewport({ ratio: 0.9 });
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/karte3.png` });
  await page.locator("[tabindex='0']").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("p[aria-live]")).toHaveText("Karte 4 von 8");
  await expect(page.getByRole("heading", { name: "Politik kommt ungefragt" })).toBeInViewport({ ratio: 0.9 });
});

test("Modul 2: Zeitrechner und Zukunfts-Ich", async ({ page }) => {
  await page.goto("/vergleich");
  await page.getByLabel("Wie viele Minuten scrollst du an einem normalen Tag?").fill("120");
  await expect(page.getByText("Das sind 730 Stunden im Jahr.").first()).toBeVisible();
  await expect(page.getByText("Gewonnen: 365 Stunden im Jahr.")).toBeVisible();
  await expect(page.getByText("So viel Zeit wie 365 Nachhilfestunden.")).toBeVisible();
  await expect(page.getByText(/Führerschein-Theorie\) zeigen wir erst/)).toBeVisible();
  await axe(page);
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/vergleich.png`, fullPage: true });
});
