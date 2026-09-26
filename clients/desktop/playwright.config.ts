import { defineConfig } from "@playwright/test";

export default defineConfig({
  outputDir: "test-results/electron",
  testDir: "src/e2e",
  testMatch: "desktop-*.spec.ts",
  timeout: process.platform === "win32" ? 60_000 : 30_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  reporter: [["line"], ["json", { outputFile: "test-results/electron-readiness.json" }]],
});
