import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { e2eRunId, serveWebServer } from "./src/serve-web-server";
import { uiOrigin } from "./src/ui-server";

const quarantine = process.env.E2E_TEST_LANE === "quarantine";
const cases = JSON.parse(readFileSync(new URL("../../scripts/ci/test-quarantine.json", import.meta.url), "utf8")) as {
  runner: string;
  name: string;
  platforms: string[];
}[];
const names = cases.filter((entry) => entry.runner === "playwright-ui" && entry.platforms.includes(process.platform));
const pattern = new RegExp(
  `(?:${names.map((entry) => entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "(?!)"})(?:\\s+@\\S+)*$`,
);

export default defineConfig({
  ...(quarantine ? { grep: pattern } : { grepInvert: pattern }),
  testDir: "./src/ui",
  testMatch: "**/*.spec.ts",
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: `test-results/${e2eRunId}`,
  globalSetup: "./src/scripts/global-setup.ts",
  reporter: [
    ["html", { open: "never", outputFolder: `playwright-report/${e2eRunId}` }],
    ["list"],
    ...(quarantine ? [["json", { outputFile: "test-results/ui-quarantine/results.json" }] as const] : []),
  ],
  use: {
    baseURL: uiOrigin,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [serveWebServer],
});
