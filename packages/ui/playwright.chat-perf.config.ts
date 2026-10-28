import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.UI_CANVAS_PORT ?? "6008");
const runId = process.env.UI_PERF_RUN_ID ?? `ui-chat-perf-${Date.now()}-${process.pid}`;

export default defineConfig({
  testDir: "./src/components/chat-ui/performance",
  testMatch: "**/*.perf.ts",
  timeout: Number(process.env.UI_PERF_TEST_TIMEOUT_MS ?? "60000"),
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  repeatEach: Number(process.env.PERF_REPEAT_EACH ?? "3"),
  outputDir: `test-results/${runId}`,
  reporter: [["html", { open: "never", outputFolder: `playwright-report/${runId}` }], ["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: process.env.PLAYWRIGHT_TRACE === "on" ? "on" : "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `bun x --no-install lerna run build:previews --scope canvas-tests && CANVAS_PREVIEW_PORT=${port} bun ../../extensions/canvas/scripts/serve-verification.ts`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
