import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const quarantine = process.env.E2E_TEST_LANE === "quarantine";
const reportName = quarantine ? "packaged-browser-quarantine" : "packaged-browser";
const cases = JSON.parse(readFileSync(new URL("../../scripts/ci/test-quarantine.json", import.meta.url), "utf8")) as {
  runner: string;
  name: string;
  platforms: string[];
  arch?: string;
}[];
const names = cases.filter(
  (entry) =>
    entry.runner === "playwright" &&
    entry.platforms.includes(process.platform) &&
    (!entry.arch || entry.arch === process.arch),
);
const pattern = new RegExp(
  `(?:${names.map((entry) => entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "(?!)"})(?:\\s+@\\S+)*$`,
);

export default defineConfig({
  ...(quarantine ? { grep: pattern } : { grepInvert: pattern }),
  testDir: "./src/packaged",
  testMatch: [
    "packaged-empty-panels.spec.ts",
    "packaged-session-tools.spec.ts",
    "packaged-paged-collections.spec.ts",
    "packaged-editing-sessions.spec.ts",
    "packaged-extension-startup.spec.ts",
    "packaged-webview-browsers.spec.ts",
    "packaged-webview-lifetime.spec.ts",
    "packaged-statistics-loading.spec.ts",
    "packaged-planner-runtime.spec.ts",
    "packaged-planner-window.spec.ts",
    "packaged-native-settings.spec.ts",
    "packaged-settings-reset.spec.ts",
    "packaged-command-query.spec.ts",
    "packaged-command-palette.spec.ts",
    "packaged-main-fullscreen.spec.ts",
  ],
  timeout: 120_000,
  workers: 1,
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
