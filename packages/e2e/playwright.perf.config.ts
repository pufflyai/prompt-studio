import { defineConfig, devices } from "@playwright/test";
import { e2eRunId, serveWebServer } from "./src/serve-web-server";
import { uiOrigin } from "./src/ui-server";

export default defineConfig({
  testDir: "./src/perf",
  testMatch: "**/*.perf.ts",
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  repeatEach: Number(process.env.PERF_REPEAT_EACH ?? "3"),
  outputDir: `test-results/perf-${e2eRunId}`,
  reporter: [["html", { open: "never", outputFolder: `playwright-report/perf-${e2eRunId}` }], ["list"]],
  use: {
    baseURL: uiOrigin,
    trace: process.env.PLAYWRIGHT_TRACE === "on" ? "on" : "off",
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
