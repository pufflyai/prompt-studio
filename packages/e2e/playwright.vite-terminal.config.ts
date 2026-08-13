import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { PSTDIO_E2E_DEFAULT_EXTENSIONS } from "./src/default-extensions";

const apiPort = Number(process.env.E2E_API_PORT ?? "3400");
const devPort = Number(process.env.E2E_VITE_DEV_PORT ?? "5176");
const previewPort = Number(process.env.E2E_VITE_PREVIEW_PORT ?? "4174");
const runId = process.env.E2E_RUN_ID ?? `vite-terminal-${Date.now()}-${process.pid}`;
const resolvedHomePath = process.env.E2E_HOME ?? mkdtempSync(join(tmpdir(), "pstdio-vite-terminal-home-"));
const bunCacheDir = process.env.E2E_BUN_CACHE_DIR ?? join(tmpdir(), "pstdio-vite-terminal-bun-cache", runId);
const apiUrl = `http://localhost:${apiPort}`;
const terminalWebSocketUrl = `ws://localhost:${apiPort}/v1/terminal`;
const terminalOrigins = [`http://localhost:${devPort}`, `http://localhost:${previewPort}`].join(",");

process.env.E2E_HOME = resolvedHomePath;

export default defineConfig({
  testDir: "./src/vite-terminal",
  testMatch: "**/*.spec.ts",
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: `test-results/${runId}`,
  reporter: [["html", { open: "never", outputFolder: `playwright-report/${runId}` }], ["list"]],
  use: {
    navigationTimeout: 60_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "vite-development",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${devPort}` },
    },
    {
      name: "vite-preview",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${previewPort}` },
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
        PSTDIO_HOME: resolvedHomePath,
        PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_DEFAULT_EXTENSIONS,
        PSTDIO_TERMINAL_ORIGINS: terminalOrigins,
        HOME: resolvedHomePath,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
      },
    },
    {
      command: `bun run --cwd ../../packages/pstdio-dashboard dev -- --host localhost --port ${devPort} --strictPort`,
      port: devPort,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PSTDIO_API_URL: apiUrl,
        PSTDIO_TERMINAL_WEBSOCKET_URL: terminalWebSocketUrl,
        HOME: resolvedHomePath,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
      },
    },
    {
      command: `bun run --cwd ../../packages/pstdio-dashboard preview -- --host localhost --port ${previewPort} --strictPort`,
      port: previewPort,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PSTDIO_API_URL: apiUrl,
        PSTDIO_TERMINAL_WEBSOCKET_URL: terminalWebSocketUrl,
        HOME: resolvedHomePath,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
      },
    },
  ],
});
