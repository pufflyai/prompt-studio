import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/packaged",
  testMatch: "packaged-webview-browsers.spec.ts",
  timeout: 120_000,
  workers: 1,
  reporter: [["line"]],
});
