import { defineConfig } from "@playwright/test";
import packaged from "./playwright.packaged.config";

// Preserve the existing workload and limits. Traces change renderer timings.
export default defineConfig({
  ...packaged,
  grep: undefined,
  grepInvert: undefined,
  testMatch: "packaged-*.bench.ts",
  use: { ...packaged.use, trace: "off" },
  outputDir: "test-results/packaged-benchmark",
  reporter: [["line"], ["json", { outputFile: "test-results/packaged-benchmarks.json" }]],
});
