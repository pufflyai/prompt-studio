import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const dashboardPort = Number(process.env.E2E_DASHBOARD_PORT ?? "5174");
const runId = process.env.E2E_RUN_ID ?? `${Date.now()}-${process.pid}`;
const agentEnv = process.env.E2E_AGENTS ?? "fake";
const storagePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-storage-"));
const homePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-home-"));
const resolvedHomePath = process.env.E2E_HOME ?? homePath;
const filesRoot = join(import.meta.dirname, "../pstdio/files");

export default defineConfig({
  testDir: "./src/ui",
  testMatch: "**/*.spec.ts",
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: `test-results/${runId}`,
  reporter: [["html", { open: "never", outputFolder: `playwright-report/${runId}` }], ["list"]],
  use: {
    baseURL: `http://localhost:${dashboardPort}`,
    trace: "on-first-retry",
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
      command: `bun run ../../packages/pstdio-api/src/server.ts`,
      port: apiPort,
      reuseExistingServer: false,
      timeout: 15_000,
      env: {
        PORT: String(apiPort),
        PSTDIO_DB_PATH: ":memory:",
        PSTDIO_STORAGE_PATH: storagePath,
        PSTDIO_FILES_ROOT: filesRoot,
        PSTDIO_AGENTS: agentEnv,
        HOME: resolvedHomePath,
      },
    },
    {
      command: `bun run --cwd ../../packages/pstdio pstdio -- --api-port ${apiPort} --dashboard-port ${dashboardPort} --no-open-browser`,
      port: dashboardPort,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
        PSTDIO_DISABLE_API_AUTO_START: "1",
        HOME: resolvedHomePath,
      },
    },
  ],
});
