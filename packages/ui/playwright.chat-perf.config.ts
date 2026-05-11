import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.UI_STORYBOOK_PORT ?? "6008");
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
    baseURL: `http://localhost:${port}`,
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
    command: `bun run build-storybook && bun ./scripts/serve-static.ts storybook-static ${port}`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
