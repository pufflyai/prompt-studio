import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { PSTDIO_E2E_DEFAULT_EXTENSIONS } from "./src/default-extensions";
import { uiOrigin } from "./src/ui-server";

const repoRoot = join(import.meta.dirname, "../..");

const serverUrl = new URL(uiOrigin);
const runId = process.env.E2E_RUN_ID ?? `${Date.now()}-${process.pid}`;
const resolvedHomePath = process.env.E2E_HOME ?? mkdtempSync(join(tmpdir(), "pstdio-e2e-home-"));
const bunCacheDir = process.env.E2E_BUN_CACHE_DIR ?? join(tmpdir(), "pstdio-e2e-bun-cache", runId);

process.env.E2E_HOME = resolvedHomePath;

export default defineConfig({
  testDir: "./src/ui",
  testMatch: "**/*.spec.ts",
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: `test-results/${runId}`,
  globalSetup: "./src/scripts/global-setup.ts",
  reporter: [["html", { open: "never", outputFolder: `playwright-report/${runId}` }], ["list"]],
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
  webServer: [
    {
      // One process now boots the API, the dashboard, and the extension runtime,
      // so it keeps the 30s budget the previous dashboard-boot server already
      // used (the API-only server it replaced needed less).
      command: `bun run --cwd ../../packages/pstdio pstdio -- serve --foreground --host ${serverUrl.hostname} --port ${serverUrl.port}`,
      url: `${uiOrigin}/healthz`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
        PSTDIO_DB_PATH: ":memory:",
        PSTDIO_EVENT_BUS_BUFFER_SIZE: "5",
        PSTDIO_HOME: resolvedHomePath,
        PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_DEFAULT_EXTENSIONS,
        PSTDIO_EXTENSION_RELEASE_REF: "e2e",
        PSTDIO_EXTENSION_SOURCE_ROOT: repoRoot,
        PSTDIO_TERMINAL_ORIGINS: uiOrigin,
        HOME: resolvedHomePath,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
      },
    },
  ],
});
