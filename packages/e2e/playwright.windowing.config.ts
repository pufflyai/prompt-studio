import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

// Windowing stories use in-memory adapters. Their spec owns its Storybook server.
export default defineConfig({
  ...config,
  testMatch: "workbench-windowing.spec.ts",
  globalSetup: undefined,
  webServer: [],
});
