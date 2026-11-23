import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

export default defineConfig({
  ...config,
  testMatch: "**/remote-session-controls.p1.spec.ts",
  // The remote-session spec starts its own two-device fixture.
  webServer: undefined,
});
