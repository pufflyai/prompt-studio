import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/performance",
  testMatch: "**/*.perf.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  repeatEach: 3,
  reporter: "list",
  webServer: { command: "bun src/scripts/preview-server.ts", url: "http://127.0.0.1:43187", timeout: 60_000 },
  use: { baseURL: "http://127.0.0.1:43187", viewport: { width: 1440, height: 1000 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
});
