import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "src/e2e",
  testMatch: "desktop-*.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "line",
});
