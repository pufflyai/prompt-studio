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
  webServer: {
    command: "bun ../../extensions/canvas/scripts/serve-verification.ts",
    url: "http://127.0.0.1:43187",
    timeout: 60_000,
  },
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }], ["list"]],
  use: {
    baseURL: "http://127.0.0.1:43187",
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
