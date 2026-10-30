import { defineConfig } from "@playwright/test";
import { benchmarkSampleCount, suites } from "pstdio-benchmarks";
import packaged from "./playwright.packaged.config";

// Preserve the existing workload and limits. Traces change renderer timings.
export default defineConfig({
  ...packaged,
  repeatEach: benchmarkSampleCount(),
  grep: undefined,
  grepInvert: undefined,
  testMatch: suites
    .find((suite) => suite.id === "workbench")!
    .files.filter((file) => file.startsWith("packages/e2e/src/packaged/"))
    .map((file) => `**/${file.replace("packages/e2e/src/packaged/", "")}`),
  use: { ...packaged.use, trace: "off" },
  outputDir: "test-results/packaged-benchmark",
  reporter: [["line"], ["json", { outputFile: "test-results/packaged-benchmarks.json" }]],
});
