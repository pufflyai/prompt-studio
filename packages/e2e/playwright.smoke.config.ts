import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

export default defineConfig(config, {
  grep: /@smoke/,
  // These dashboard flows use the real app and do not need Storybook servers.
  globalSetup: undefined,
});
