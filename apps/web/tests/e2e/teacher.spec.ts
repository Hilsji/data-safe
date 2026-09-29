import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function contribute(request: APIRequestContext, code: string) {
  const join = await (await request.post("/api/class/join", { data: { code } })).json();
  const r = await request.post("/api/class/contribute", {
    data: {
      token: join.contributionToken,
      durationMin: join.durationMin,
      contentCorrectBucket: join.durationMin === 15 ? 7 : 4,
      recognitionDPrimeBucket: 5,
      videosSeenBucket: join.durationMin === 15 ? 1 : 4,
      prospectiveSuccess: join.durationMin === 15,
      topCategory: "gaming",
      entropyDropBucket: 6,
    },
  });
  expect(r.ok()).toBe(true);
  return join.groupId as string;
}

test("Lehrkraft: Magic Link, Klasse, Beitritte, anonyme Ergebnisse, Arbeitsblatt", async ({ page, request }) => {
  await page.goto("/lehrkraft");
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  await axe(page);

  // unberechtigte Adresse: gleiche Antwort, keine Mail
  await request.get("/api/test/last-mail");
  await page.getByLabel("E-Mail-Adresse").fill("frau.mueller@schule.example");
  await page.getByRole("button", { name: "Link schicken" }).click();
  await expect(page.getByText(/Wenn deine Adresse freigeschaltet ist/)).toBeVisible();
  const mail = (await (await request.get("/api/test/last-mail")).json()).text as string;
  const link = mail.match(/https?:\/\/\S+token=\S+/)![0];
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Deine Klassen-Sessions" })).toBeVisible();

  // Link ist nur einmal gültig
  const again = await request.get(link, { maxRedirects: 0 });
  expect(again.headers()["location"]).toContain("login=abgelaufen");

  await page.getByLabel(/Titel/).fill("8b Medienkunde");
  await page.getByLabel(/Ich bestätige/).check();
  await axe(page);
  await page.getByRole("button", { name: "Anlegen" }).click();
  await page.getByRole("link", { name: /8b Medienkunde/ }).click();

  await expect(page.getByText("Klassen-Code")).toBeVisible();
  const code = (await page.locator("p.font-mono").first().textContent())!.trim();
  expect(code).toMatch(/^[0-9A-Z]{6}$/);
  await expect(page.getByText(/Ergebnisse erscheinen, wenn du die Runde schließt/)).toBeVisible();

  // 12 Beitritte: Gruppen A/B abwechselnd; in Gruppe B tragen nur 4 bei
  const groups: string[] = [];
  for (let i = 0; i < 9; i++) groups.push(await contribute(request, code));
  expect(groups.filter((g) => g === "A")).toHaveLength(5);
  expect(groups.filter((g) => g === "B")).toHaveLength(4);
  for (let i = 0; i < 3; i++) await request.post("/api/class/join", { data: { code } });

  // Beamer-Ansicht
  await page.getByRole("button", { name: "Runde starten (Countdown)" }).click();
  await expect(page.getByRole("button", { name: "Runde starten (Countdown)" })).toBeHidden();
  await page.getByRole("link", { name: "Beamer-Ansicht" }).click();
  await expect(page.getByText(/noch \d+:\d{2}/).first()).toBeVisible();
  await page.goBack();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Runde schließen und Ergebnisse anzeigen" }).click();
  await expect(page.getByRole("heading", { name: "Ergebnisse (anonym)" })).toBeVisible();
  await expect(page.getByText("Weniger als 5 Beiträge – aus Datenschutzgründen keine Auswertung.")).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Beiträge" })).toBeVisible();
  await expect(page.getByText("Teilnehmende").or(page.getByText(/Beigetreten: 12/))).toBeVisible();
  await axe(page);

  // Nach dem Schließen: keine Beiträge mehr
  const late = await (await request.post("/api/class/join", { data: { code } })).status();
  expect(late).toBe(404);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Arbeitsblatt als PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/^Arbeitsblatt_.*\.pdf$/);
  const download2 = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ergebnisse als PDF" }).click();
  expect((await download2).suggestedFilename()).toMatch(/^Ergebnisse_.*\.pdf$/);
});

async function loginAndCreateClass(page: Page, request: APIRequestContext, guardian: boolean): Promise<string> {
  await page.goto("/lehrkraft");
  await page.getByLabel("E-Mail-Adresse").fill("herr.schmidt@schule.example");
  await page.getByRole("button", { name: "Link schicken" }).click();
  await expect(page.getByText(/Wenn deine Adresse freigeschaltet ist/)).toBeVisible();
  const mail = (await (await request.get("/api/test/last-mail")).json()).text as string;
  await page.goto(mail.match(/https?:\/\/\S+token=\S+/)![0]);
  await page.getByLabel(/Titel/).fill(guardian ? "9a Einwilligung ok" : "9c ohne Einwilligung");
  if (guardian) await page.getByLabel(/Ich bestätige/).check();
  await page.getByRole("button", { name: "Anlegen" }).click();
  await page.getByRole("link", { name: guardian ? /9a Einwilligung ok/ : /9c ohne Einwilligung/ }).click();
  await expect(page.getByText("Klassen-Code")).toBeVisible();
  return (await page.locator("p.font-mono").first().textContent())!.trim();
}

test("Schüler unter 16: Klassen-Code, Gruppe gibt die Dauer vor", async ({ browser, page, request }) => {
  const code = await loginAndCreateClass(page, request, true);
  const student = await (await browser.newContext()).newPage();
  await student.goto("/arena");
  await student.getByLabel("14 oder 15").check();
  await student.getByRole("button", { name: "Weiter" }).click();
  await student.getByLabel(/Ich bin einverstanden/).check();
  await student.getByLabel(/Klassen-Code/).fill(code);
  await student.getByRole("button", { name: "Weiter" }).click();
  await expect(student.getByRole("heading", { name: "Deine persönliche ID" })).toBeVisible();
  await student.getByLabel("Ich habe meine ID notiert.").check();
  await student.getByRole("button", { name: "Weiter" }).click();
  await student.getByRole("button", { name: "Los geht’s" }).click();
  await expect(student.getByText("War dieses Wort dabei?")).toBeVisible({ timeout: 40_000 });
  for (let i = 0; i < 16; i++) await student.getByRole("button", { name: "Nein" }).click();
  await expect(student.getByText(/Gruppe „Gruppe A“ · du scrollst 15 Minuten/)).toBeVisible();
  await expect(student.getByText(/Dein Name in der Klassenliste: \S+ \S+ \d{2}/)).toBeVisible();
  await expect(student.getByRole("group", { name: "Wie lange willst du scrollen?" })).toHaveCount(0);
  await student.getByLabel("TikTok").check();
  await student.getByLabel("Ich habe mir das Wort gemerkt.").check();
  await student.getByRole("button", { name: "Weiter" }).click();
  await expect(student.getByRole("heading", { name: "So startest du die Aufnahme" })).toBeVisible();
});

test("Schüler unter 16 ohne bestätigte Einwilligung wird gestoppt", async ({ browser, page, request }) => {
  const code = await loginAndCreateClass(page, request, false);
  const student = await (await browser.newContext()).newPage();
  await student.goto("/arena");
  await student.getByLabel("14 oder 15").check();
  await student.getByRole("button", { name: "Weiter" }).click();
  await student.getByLabel(/Ich bin einverstanden/).check();
  await student.getByLabel(/Klassen-Code/).fill(code);
  await student.getByRole("button", { name: "Weiter" }).click();
  await expect(student.getByText(/noch nicht bestätigt, dass die Einwilligungen/)).toBeVisible();
});

test("Dashboard-API ohne Anmeldung gesperrt", async ({ request }) => {
  expect((await request.get("/api/class")).status()).toBe(401);
  expect((await request.post("/api/class", { data: {} })).status()).toBe(401);
});
