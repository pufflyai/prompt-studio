import { defineConfig, devices } from "@playwright/test";
import { benchmarkSampleCount } from "pstdio-benchmarks";

export default defineConfig({
  testDir: "./src/performance",
  testMatch: "**/*.bench.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  repeatEach: benchmarkSampleCount(3),
  reporter: "list",
  webServer: {
    command: "bun ../../extensions/canvas/scripts/serve-verification.ts",
    url: "http://127.0.0.1:43187",
    timeout: 60_000,
  },
  use: { baseURL: "http://127.0.0.1:43187", viewport: { width: 1440, height: 1000 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
});
