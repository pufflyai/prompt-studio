import { defineConfig } from "@playwright/test";
import { benchmarkSampleCount, suites } from "pstdio-benchmarks";

// Benchmarks measure the packaged app without traces. One worker runs files in name order and
// tests in declaration order; packaged-launch.p3.bench.ts relies on that order for its cold start.
export default defineConfig({
  outputDir: "test-results/benchmark",
  testDir: "src/e2e",
  testMatch: suites
    .find((suite) => suite.id === "desktop")!
    .files.map((file) => `**/${file.replace("clients/desktop/src/e2e/", "")}`),
  // Windows and hosted Intel macOS runners need longer for real launches and setup (approved 2026-10-10).
  timeout: process.platform === "win32" || (process.platform === "darwin" && process.arch === "x64") ? 60_000 : 30_000,
  workers: 1,
  repeatEach: benchmarkSampleCount(),
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  metadata: { electronTrace: false },
  reporter: [["line"], ["json", { outputFile: "test-results/packaged-benchmarks.json" }]],
});
