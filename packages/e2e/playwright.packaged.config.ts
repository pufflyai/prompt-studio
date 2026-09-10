import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/packaged",
  testMatch: "packaged-webview-browsers.spec.ts",
  timeout: 120_000,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: "test-results/packaged-browser",
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report/packaged-browser" }]],
});
