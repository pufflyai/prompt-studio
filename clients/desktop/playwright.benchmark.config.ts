import { defineConfig } from "@playwright/test";
import { suites } from "pstdio-benchmarks";
import { playwrightQuarantineSelection } from "pstdio-scripts/test-quarantine";

const quarantine = process.env.E2E_TEST_LANE === "quarantine";
const ordered = process.env.E2E_TEST_LANE === "benchmark";

// Benchmarks measure the packaged app without traces. One worker runs files in name order and
// tests in declaration order; packaged-launch.p3.bench.ts relies on that order for its cold start.
export default defineConfig({
  outputDir: quarantine ? "test-results/benchmark-quarantine" : "test-results/benchmark",
  testDir: "src/e2e",
  testMatch: suites
    .find((suite) => suite.id === "desktop")!
    .files.map((file) => `**/${file.replace("clients/desktop/src/e2e/", "")}`),
  ...(ordered
    ? {}
    : playwrightQuarantineSelection("packaged-desktop-benchmark", "clients/desktop/src/e2e", quarantine)),
  // Windows and hosted Intel macOS runners need longer for real launches and setup (approved 2026-10-10).
  timeout: process.platform === "win32" || (process.platform === "darwin" && process.arch === "x64") ? 60_000 : 30_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  repeatEach: 1,
  retries: 0,
  metadata: {
    electronTrace: false,
    quarantineAttempt: quarantine || ordered ? process.env.CI_QUARANTINE_ATTEMPT : undefined,
  },
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: quarantine
          ? "test-results/packaged-benchmarks-quarantine.json"
          : "test-results/packaged-benchmarks.json",
      },
    ],
  ],
});
