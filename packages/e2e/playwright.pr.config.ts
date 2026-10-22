import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

export default defineConfig(config, {
  // The selected real-app specs do not use Storybook. Every matrix row has its own runtime and data.
  globalSetup: undefined,
});
