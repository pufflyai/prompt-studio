import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import { devDependencies } from "../../../package.json";

// Read the pinned dependency without importing the package that compile commands externalize.
export const smokePlaywrightVersion = devDependencies["playwright-core"];

export const smokeBrowserInstallDirectory = () =>
  join(resolvePstdioHome(), "cache", "extension-browser-install", smokePlaywrightVersion);

export const loadSmokePlaywright = () => {
  const directory = smokeBrowserInstallDirectory();
  if (!existsSync(join(directory, "node_modules", "playwright-core", "package.json")))
    throw new Error("Playwright is missing. Run: pst extensions install-browser");
  const require = createRequire(join(directory, "package.json"));
  return require("playwright-core") as typeof import("playwright-core");
};
