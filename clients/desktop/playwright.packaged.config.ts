import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const quarantine = process.env.E2E_TEST_LANE === "quarantine";
const cases = JSON.parse(readFileSync(new URL("../../scripts/ci/test-quarantine.json", import.meta.url), "utf8")) as {
  runner: string;
  name: string;
  platforms: string[];
  arch?: string;
}[];
const names = cases.filter(
  (entry) =>
    entry.runner === "packaged-desktop" &&
    entry.platforms.includes(process.platform) &&
    (!entry.arch || entry.arch === process.arch),
);
const pattern = new RegExp(
  `(?:${names.map((entry) => entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "(?!)"})(?:\\s+@\\S+)*$`,
);

export default defineConfig({
  maxFailures: process.env.CI_PRIORITY === "P1" ? 1 : 0,
  ...(quarantine ? { grep: pattern } : { grepInvert: pattern }),
  outputDir: quarantine ? "test-results/packaged-quarantine" : "test-results/packaged",
  testDir: "src/e2e",
  testMatch: "packaged-*.spec.ts",
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
