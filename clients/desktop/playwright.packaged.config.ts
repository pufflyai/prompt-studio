import { defineConfig } from "@playwright/test";
import { playwrightQuarantineSelection } from "pstdio-scripts/test-quarantine";

const quarantine = process.env.E2E_TEST_LANE === "quarantine";
export default defineConfig({
  maxFailures: process.env.CI_PRIORITY === "P1" ? 1 : 0,
  outputDir: quarantine ? "test-results/packaged-quarantine" : "test-results/packaged",
  testDir: "src/e2e",
  testMatch:
    process.env.TEST_PRIORITIES?.split(",").map((priority) => `packaged-*.${priority.toLowerCase()}.spec.ts`) ??
    "packaged-*.spec.ts",
  ...playwrightQuarantineSelection("packaged-desktop", "clients/desktop/src/e2e", quarantine),
  // Windows and hosted Intel macOS runners need longer for real launches and setup (approved 2026-10-10).
  timeout: process.platform === "win32" || (process.platform === "darwin" && process.arch === "x64") ? 60_000 : 30_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  reporter: [
    ["line"],
    [
      "json",
      {
        outputFile: quarantine
          ? "test-results/packaged-quarantine-readiness.json"
          : "test-results/packaged-release-readiness.json",
      },
    ],
  ],
});
