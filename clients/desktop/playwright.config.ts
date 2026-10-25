import { defineConfig } from "@playwright/test";

export default defineConfig({
  maxFailures: process.env.CI_PRIORITY === "P1" ? 1 : 0,
  outputDir: "test-results/electron",
  testDir: "src/e2e",
  testMatch:
    process.env.TEST_PRIORITIES?.split(",").map((priority) => `desktop-*.${priority.toLowerCase()}.spec.ts`) ??
    "desktop-*.spec.ts",
  // Windows and hosted Intel macOS runners need longer for real launches and setup (approved 2026-10-10).
  timeout: process.platform === "win32" || (process.platform === "darwin" && process.arch === "x64") ? 60_000 : 30_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  reporter: [["line"], ["json", { outputFile: "test-results/electron-readiness.json" }]],
});
