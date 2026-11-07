import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/mercanova_test";

/**
 * E2E del flujo de compra contra un build de producción, la base efímera db-test y SIN IA
 * (el flujo de compra no depende de Gemini). Requiere: docker compose --profile test up -d --wait db-test
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://localhost:${PORT}`, locale: "es-UY", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "npm run build && cp -R public .next/standalone/ && cp -R .next/static .next/standalone/.next/ && node .next/standalone/server.js",
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { PORT: String(PORT), HOSTNAME: "127.0.0.1", DATABASE_URL: TEST_DB, GEMINI_API_KEY: "" },
  },
});
