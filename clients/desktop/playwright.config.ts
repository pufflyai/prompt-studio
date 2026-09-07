import { defineConfig } from "@playwright/test";

export default defineConfig({
  outputDir: "test-results/electron",
  testDir: "src/e2e",
  testMatch: "desktop-*.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: [["line"], ["json", { outputFile: "test-results/electron-readiness.json" }]],
});
