import { defineConfig } from "@playwright/test";

export default defineConfig({
  outputDir: "test-results/packaged",
  testDir: "src/e2e",
  testMatch: "packaged-*.spec.ts",
  // Windows and hosted Intel macOS runners need longer for real launches and setup (approved 2026-10-10).
  timeout: process.platform === "win32" || (process.platform === "darwin" && process.arch === "x64") ? 60_000 : 30_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  reporter: [["line"], ["json", { outputFile: "test-results/packaged-release-readiness.json" }]],
});
