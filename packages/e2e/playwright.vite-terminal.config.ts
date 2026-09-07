import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { PSTDIO_E2E_DEFAULT_EXTENSIONS } from "./src/default-extensions";
import { viteOrigins } from "./src/vite-terminal-servers";

const apiUrl = new URL(viteOrigins.api);
const devUrl = new URL(viteOrigins.dev);
const previewUrl = new URL(viteOrigins.preview);
const runId = process.env.E2E_RUN_ID ?? `vite-terminal-${Date.now()}-${process.pid}`;
const resolvedHomePath = process.env.E2E_HOME ?? mkdtempSync(join(tmpdir(), "pstdio-vite-terminal-home-"));
const bunCacheDir = process.env.E2E_BUN_CACHE_DIR ?? join(tmpdir(), "pstdio-vite-terminal-bun-cache", runId);
const terminalWebSocketUrl = `${viteOrigins.api.replace("http", "ws")}/v1/terminal`;
const terminalOrigins = [viteOrigins.dev, viteOrigins.preview].join(",");

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
      use: { ...devices["Desktop Chrome"], baseURL: viteOrigins.dev },
    },
    {
      name: "vite-preview",
      use: { ...devices["Desktop Chrome"], baseURL: viteOrigins.preview },
    },
  ],
  webServer: [
    {
      command: `bun run ../../packages/pstdio/src/index.ts serve --foreground --host ${apiUrl.hostname} --port ${apiUrl.port}`,
      url: `${viteOrigins.api}/healthz`,
      reuseExistingServer: false,
      timeout: 15_000,
      env: {
        PSTDIO_DB_PATH: ":memory:",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
        PSTDIO_EVENT_BUS_BUFFER_SIZE: "5",
        PSTDIO_HOME: resolvedHomePath,
        PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_DEFAULT_EXTENSIONS,
        PSTDIO_TERMINAL_ORIGINS: terminalOrigins,
        HOME: resolvedHomePath,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
      },
    },
    {
      command: `bun run --cwd ../../packages/pstdio-dashboard dev -- --host ${devUrl.hostname} --port ${devUrl.port} --strictPort`,
      url: viteOrigins.dev,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PSTDIO_API_URL: viteOrigins.api,
        PSTDIO_TERMINAL_WEBSOCKET_URL: terminalWebSocketUrl,
        HOME: resolvedHomePath,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
      },
    },
    {
      command: `bun run --cwd ../../packages/pstdio-dashboard preview -- --host ${previewUrl.hostname} --port ${previewUrl.port} --strictPort`,
      url: viteOrigins.preview,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PSTDIO_API_URL: viteOrigins.api,
        PSTDIO_TERMINAL_WEBSOCKET_URL: terminalWebSocketUrl,
        HOME: resolvedHomePath,
        BUN_INSTALL_CACHE_DIR: bunCacheDir,
      },
    },
  ],
});
