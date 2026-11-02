import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { BrowserType, LaunchOptions } from "@playwright/test";

export const browserLaunchOptions = (type: BrowserType, root: string, options: LaunchOptions) => {
  if (process.platform !== "darwin" || type.name() !== "firefox") return options;

  const appData = join(root, "firefox-app-data");
  const localAppData = join(root, "firefox-local-app-data");
  mkdirSync(appData, { recursive: true });
  mkdirSync(localAppData, { recursive: true });

  // A temporary profile alone still reads protected shared app data on macOS 27 (ADR 0116).
  return {
    ...options,
    env: {
      ...process.env,
      ...options.env,
      MOZ_APP_DATA: appData,
      MOZ_LOCAL_APP_DATA: localAppData,
    },
  };
};
