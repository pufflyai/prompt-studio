import { defineConfig, devices } from "@playwright/test";
import { playwrightQuarantineSelection } from "pstdio-scripts/test-quarantine";
import { e2eRunId, serveWebServer } from "./src/serve-web-server";
import { uiOrigin } from "./src/ui-server";

const quarantine = process.env.E2E_TEST_LANE === "quarantine";
export default defineConfig({
  testDir: "./src/ui",
  testMatch:
    process.env.TEST_PRIORITIES?.split(",").map((priority) => `**/*.${priority.toLowerCase()}.spec.ts`) ??
    "**/*.spec.ts",
  ...playwrightQuarantineSelection("playwright-ui", "packages/e2e/src/ui", quarantine),
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: `test-results/${e2eRunId}`,
  globalSetup: "./src/scripts/global-setup.ts",
  reporter: [
    ["html", { open: "never", outputFolder: `playwright-report/${e2eRunId}` }],
    ["list"],
    ...(quarantine ? [["json", { outputFile: "test-results/ui-quarantine/results.json" }] as const] : []),
  ],
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
