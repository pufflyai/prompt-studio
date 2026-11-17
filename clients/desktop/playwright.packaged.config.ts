import { defineConfig } from "@playwright/test";
import { playwrightQuarantineSelection } from "pstdio-scripts/testing";

const quarantine = process.env.E2E_TEST_LANE === "quarantine";
const executionPath = [process.env.CI_TEST_EXECUTION_ID, process.env.CI_PLAN_RUN_ID].filter(Boolean).join("/");
const outputDir = `test-results/${quarantine ? "packaged-quarantine" : "packaged"}${executionPath ? `/${executionPath}` : ""}`;
const reportName = quarantine ? "packaged-quarantine-readiness" : "packaged-release-readiness";
const outputFile = executionPath && !quarantine ? `${outputDir}/readiness.json` : `test-results/${reportName}.json`;
export default defineConfig({
  maxFailures: process.env.CI_PRIORITY === "P1" && process.env.CI_PROFILE !== "production" ? 1 : 0,
  outputDir,
  testDir: "src/e2e",
  testMatch:
    process.env.TEST_PRIORITIES?.split(",").map((priority) => `packaged-*.${priority.toLowerCase()}.spec.ts`) ??
    "packaged-*.spec.ts",
  ...playwrightQuarantineSelection("packaged-desktop", "clients/desktop/src/e2e", quarantine),
  // Real launches, cold tool preparation and cleanup exceeded 30 s on Apple Silicon.
  // PS-1232: setup/test allowance authorized 2026-11-17; benchmarks retain their budgets.
  timeout: 120_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  reporter: [
    ...(process.env.CI_PLAN_REPORTER ? [[process.env.CI_PLAN_REPORTER] as [string]] : []),
    ["line"],
    [
      "json",
      {
        outputFile,
      },
    ],
  ],
});
