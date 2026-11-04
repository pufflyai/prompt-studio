import { resolve } from "node:path";
import catalog from "../../packages/pstdio-api/files/extension-catalog.json";

export const resolveWorkingTreeDefaultExtensions = (repoRoot: string, resolvePath = resolve) => ({
  defaultExtensions: catalog.extensions
    .filter((entry) => entry.default || ("alwaysEnabled" in entry && entry.alwaysEnabled))
    .map(({ installName, origin }) => ({
      force: true,
      installName,
      skipInstall: true,
      source: resolvePath(repoRoot, origin.path),
    })),
});
