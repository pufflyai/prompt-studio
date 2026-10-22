import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/packaged",
  testMatch: [
    "packaged-empty-panels.spec.ts",
    "packaged-editing-sessions.spec.ts",
    "packaged-extension-startup.spec.ts",
    "packaged-webview-browsers.spec.ts",
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
  outputDir: "test-results/packaged-browser",
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report/packaged-browser" }]],
});
