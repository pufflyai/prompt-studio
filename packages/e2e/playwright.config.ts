import { defineConfig, devices } from "@playwright/test";
import { e2eRunId, serveWebServer } from "./src/serve-web-server";
import { uiOrigin } from "./src/ui-server";

export default defineConfig({
  testDir: "./src/ui",
  testMatch: "**/*.spec.ts",
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: `test-results/${e2eRunId}`,
  globalSetup: "./src/scripts/global-setup.ts",
  reporter: [["html", { open: "never", outputFolder: `playwright-report/${e2eRunId}` }], ["list"]],
  use: {
    baseURL: uiOrigin,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [serveWebServer],
});
