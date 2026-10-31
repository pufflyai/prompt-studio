import { defineConfig, devices } from "@playwright/test";
import { suites } from "pstdio-benchmarks";
import { e2eRunId, serveWebServer } from "./src/serve-web-server";
import { uiOrigin } from "./src/ui-server";

export default defineConfig({
  testDir: "./src/perf",
  globalSetup: "./src/scripts/global-setup.ts",
  testMatch: suites
    .find((suite) => suite.id === "workbench")!
    .files.filter((file) => file.startsWith("packages/e2e/src/perf/"))
    .map((file) => `**/${file.replace("packages/e2e/src/perf/", "")}`),
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  repeatEach: 1,
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
