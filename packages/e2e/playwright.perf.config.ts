import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { PSTDIO_E2E_DEFAULT_EXTENSIONS } from "./src/default-extensions";

const apiPort = Number(process.env.E2E_API_PORT ?? "3300");
const dashboardPort = Number(process.env.E2E_DASHBOARD_PORT ?? "5175");
const runId = process.env.E2E_RUN_ID ?? `perf-${Date.now()}-${process.pid}`;
process.env.E2E_RUN_ID = runId;
const homePath = mkdtempSync(join(tmpdir(), "pstdio-perf-home-"));
const bunCacheDir = process.env.E2E_BUN_CACHE_DIR ?? join(tmpdir(), "pstdio-perf-bun-cache", runId);

export default defineConfig({
  testDir: "./src/perf",
  testMatch: "**/*.perf.ts",
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  repeatEach: Number(process.env.PERF_REPEAT_EACH ?? "3"),
  outputDir: `test-results/${runId}`,
  reporter: [["html", { open: "never", outputFolder: `playwright-report/${runId}` }], ["list"]],
  use: {
    baseURL: `http://localhost:${dashboardPort}`,
    trace: process.env.PLAYWRIGHT_TRACE === "on" ? "on" : "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "bun run ../../packages/pstdio-api/src/server.ts",
      port: apiPort,
      reuseExistingServer: false,
      timeout: 15_000,
      env: {
        PORT: String(apiPort),
        PSTDIO_DB_PATH: ":memory:",
        PSTDIO_EVENT_BUS_BUFFER_SIZE: "5",
        PSTDIO_HOME: homePath,
        PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_DEFAULT_EXTENSIONS,
        HOME: homePath,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
      },
    },
    {
      command: `bun run --cwd ../../packages/pstdio-dashboard build && bun run --cwd ../../packages/pstdio-dashboard preview -- --host localhost --port ${dashboardPort}`,
      port: dashboardPort,
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        PSTDIO_API_URL: `http://localhost:${apiPort}`,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
        HOME: homePath,
      },
    },
  ],
});
