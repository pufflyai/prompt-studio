import { defineConfig } from "@playwright/test";

const executionPath = [process.env.CI_TEST_EXECUTION_ID, process.env.CI_PLAN_RUN_ID].filter(Boolean).join("/");
const outputDir = `test-results/electron${executionPath ? `/${executionPath}` : ""}`;

export default defineConfig({
  globalSetup: "./src/testing/source-electron-setup.ts",
  maxFailures: process.env.CI_PRIORITY === "P1" && process.env.CI_PROFILE !== "production" ? 1 : 0,
  outputDir,
  testDir: "src/e2e",
  testMatch:
    process.env.TEST_PRIORITIES?.split(",").map((priority) => `desktop-*.${priority.toLowerCase()}.spec.ts`) ??
    "desktop-*.spec.ts",
  // Windows and hosted Intel macOS runners need longer for real launches and setup (approved 2026-10-10).
  timeout: process.platform === "win32" || (process.platform === "darwin" && process.arch === "x64") ? 60_000 : 30_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  reporter: [
    ...(process.env.CI_PLAN_REPORTER ? [[process.env.CI_PLAN_REPORTER] as [string]] : []),
    ["line"],
    ["json", { outputFile: executionPath ? `${outputDir}/readiness.json` : "test-results/electron-readiness.json" }],
  ],
});
