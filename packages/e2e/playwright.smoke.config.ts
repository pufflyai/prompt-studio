import { defineConfig } from "@playwright/test";
import { browserSmokeTestMatch } from "pstdio-scripts/testing";
import config from "./playwright.config";

export default defineConfig(config, {
  testMatch: browserSmokeTestMatch,
  // These dashboard flows use the real app and do not need Canvas previews.
  globalSetup: undefined,
});
