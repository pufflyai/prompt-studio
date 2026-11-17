import { defineConfig } from "@playwright/test";
import { browserSmokeTestMatch } from "pstdio-scripts/testing";
import config from "./playwright.config";
import { e2eExtensions } from "./src/default-extensions";

const servers = Array.isArray(config.webServer) ? config.webServer : [config.webServer!];

export default defineConfig({
  ...config,
  testMatch: browserSmokeTestMatch,
  // These dashboard flows use the real app and do not need Canvas previews.
  globalSetup: undefined,
  // These project-picker/Home flows use the configured dashboard after onboarding,
  // just like the broader UI fixture. Install their tools without unrelated apps or harnesses.
  webServer: servers.map((server) => ({
    ...server,
    env: {
      ...server.env,
      PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions(
        "pstdio-home",
        "pstdio-session-browser",
        "pstdio-base-themes",
        "pstdio-skills",
      ),
    },
  })),
});
