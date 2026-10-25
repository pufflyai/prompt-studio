import { defineConfig } from "@playwright/test";
import { playwrightQuarantineSelection } from "pstdio-scripts/test-quarantine";

const quarantine = process.env.E2E_TEST_LANE === "quarantine";
const reportName = quarantine ? "packaged-browser-quarantine" : "packaged-browser";
export default defineConfig({
  testDir: "./src/packaged",
  testMatch:
    process.env.TEST_PRIORITIES?.split(",").map((priority) => `packaged-*.${priority.toLowerCase()}.spec.ts`) ??
    "packaged-*.spec.ts",
  ...playwrightQuarantineSelection("playwright", "packages/e2e/src/packaged", quarantine),
  timeout: 120_000,
  workers: 1,
  maxFailures: !quarantine && process.env.CI_PRIORITY === "P1" ? 1 : 0,
  retries: 0,
  forbidOnly: !!process.env.CI,
  use: { trace: "retain-on-failure" },
  outputDir: `test-results/${reportName}`,
  reporter: [
    ["line"],
    ["html", { open: "never", outputFolder: `playwright-report/${reportName}` }],
    ["json", { outputFile: `test-results/${reportName}/results.json` }],
  ],
});
