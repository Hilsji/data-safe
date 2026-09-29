import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3200);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npx next dev -p ${port}`,
    port,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { UPLOAD_DIR: "./data/e2e-uploads", ENABLE_TEST_ROUTES: "1", RATE_LIMIT_FACTOR: "50", TEACHER_EMAIL_DOMAINS: "schule.example", APP_URL: `http://localhost:${port}` },
  },
});
