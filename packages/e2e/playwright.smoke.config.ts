import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

export default defineConfig(config, {
  testMatch: "startup.p1.spec.ts",
  // These dashboard flows use the real app and do not need Canvas previews.
  globalSetup: undefined,
});
