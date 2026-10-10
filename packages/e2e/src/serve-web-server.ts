import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlaywrightTestConfig } from "@playwright/test";
import { PSTDIO_E2E_DEFAULT_EXTENSIONS } from "./default-extensions";
import { uiOrigin } from "./ui-server";

const repoRoot = join(import.meta.dirname, "../..");
const serverUrl = new URL(uiOrigin);

// Playwright evaluates the config again in every worker. Keeping the run id and home in the
// environment makes every process use the same output folder and server home.
export const e2eRunId = process.env.E2E_RUN_ID ?? `${Date.now()}-${process.pid}`;
const homePath = process.env.E2E_HOME ?? mkdtempSync(join(tmpdir(), "pstdio-e2e-home-"));
process.env.E2E_RUN_ID = e2eRunId;
process.env.E2E_HOME = homePath;

const bunCacheDir = process.env.E2E_BUN_CACHE_DIR ?? join(tmpdir(), "pstdio-e2e-bun-cache", e2eRunId);

// The isolated `pstdio serve` runtime shared by the dashboard and performance suites.
export const serveWebServer = {
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
    PSTDIO_HOME: homePath,
    PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_DEFAULT_EXTENSIONS,
    PSTDIO_EXTENSION_RELEASE_REF: "e2e",
    PSTDIO_EXTENSION_SOURCE_ROOT: repoRoot,
    PSTDIO_TERMINAL_ORIGINS: uiOrigin,
    HOME: homePath,
    BUN_INSTALL_CACHE_DIR: bunCacheDir,
  },
} satisfies PlaywrightTestConfig["webServer"];
