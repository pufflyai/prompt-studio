import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/ui",
  testMatch:
    process.env.TEST_PRIORITIES?.split(",").map((priority) => `**/*.${priority.toLowerCase()}.spec.ts`) ??
    "**/*.spec.ts",
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: "test-results",
  globalSetup: "./src/scripts/global-setup.ts",
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }], ["list"]],
  use: { navigationTimeout: 60_000, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
