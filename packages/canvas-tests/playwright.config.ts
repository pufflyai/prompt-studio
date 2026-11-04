import { defineConfig, devices } from "@playwright/test";

const previewUrl = `http://127.0.0.1:${process.env.CANVAS_PREVIEW_PORT ?? 43187}`;

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
    url: previewUrl,
    timeout: 60_000,
  },
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }], ["list"]],
  use: {
    baseURL: previewUrl,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
