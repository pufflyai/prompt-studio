import { defineConfig } from "@playwright/test";

export default defineConfig({
  outputDir: "test-results/packaged",
  testDir: "src/e2e",
  testMatch: "packaged-*.spec.ts",
  workers: 1,
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  reporter: [["line"], ["json", { outputFile: "test-results/packaged-release-readiness.json" }]],
});
