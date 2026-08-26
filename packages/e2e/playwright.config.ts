import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { PSTDIO_E2E_DEFAULT_EXTENSIONS } from "./src/default-extensions";

const repoRoot = join(import.meta.dirname, "../..");

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const dashboardPort = Number(process.env.E2E_DASHBOARD_PORT ?? "5174");
const runId = process.env.E2E_RUN_ID ?? `${Date.now()}-${process.pid}`;
const homePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-home-"));
const resolvedHomePath = process.env.E2E_HOME ?? homePath;
const bunCacheDir = process.env.E2E_BUN_CACHE_DIR ?? join(tmpdir(), "pstdio-e2e-bun-cache", runId);

process.env.E2E_HOME = resolvedHomePath;

// Quarantined while the dashboard is rebuilt on the workbench runtime. These
// specs exercise the pre-workbench dashboard (ticket/session/workspace routes,
// the old project-list ingress, extensions and settings panels) which the new
// workbench dashboard does not reconstruct yet. Re-enable or rewrite each spec
// as its feature is ported back. dashboard.spec.ts and workspaces.spec.ts still
// pass against the workbench shell and stay enabled.
const quarantinedWorkbenchMigrationSpecs = [
  "**/command-palette-actions.spec.ts",
  "**/command-palette-keyboard.spec.ts",
  "**/extensions.spec.ts",
  "**/project-settings.spec.ts",
  "**/projects.spec.ts",
  "**/session-chat-and-workspaces.spec.ts",
  "**/sessions.spec.ts",
  "**/stale-reconnect-dashboard.spec.ts",
  "**/ticket-workspace-images.spec.ts",
  "**/tickets-board-scroll.spec.ts",
  "**/tickets-shell.spec.ts",
  "**/tickets.spec.ts",
  "**/tree-list-keyboard.spec.ts",
];

export default defineConfig({
  testDir: "./src/ui",
  testMatch: "**/*.spec.ts",
  testIgnore: quarantinedWorkbenchMigrationSpecs,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: `test-results/${runId}`,
  globalSetup: "./src/scripts/global-setup.ts",
  reporter: [["html", { open: "never", outputFolder: `playwright-report/${runId}` }], ["list"]],
  use: {
    baseURL: `http://localhost:${dashboardPort}`,
    navigationTimeout: 60_000,
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
        PSTDIO_EVENT_BUS_BUFFER_SIZE: "5",
        PSTDIO_HOME: resolvedHomePath,
        PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_DEFAULT_EXTENSIONS,
        PSTDIO_EXTENSION_RELEASE_REF: "e2e",
        PSTDIO_EXTENSION_SOURCE_ROOT: repoRoot,
        PSTDIO_TERMINAL_ORIGINS: `http://localhost:${dashboardPort}`,
        HOME: resolvedHomePath,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
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
        PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_DEFAULT_EXTENSIONS,
        PSTDIO_HOME: resolvedHomePath,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
        HOME: resolvedHomePath,
      },
    },
  ],
});
