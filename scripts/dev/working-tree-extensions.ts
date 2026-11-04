import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface DefaultCatalog {
  extensions: { installName: string; default: boolean; alwaysEnabled?: boolean; origin: { path: string } }[];
}
const catalog = JSON.parse(
  readFileSync(new URL("../../packages/pstdio-api/files/extension-catalog.json", import.meta.url), "utf8"),
) as DefaultCatalog;

export const resolveWorkingTreeDefaultExtensions = (repoRoot: string, resolvePath = resolve) => ({
  defaultExtensions: catalog.extensions
    .filter((entry) => entry.default || entry.alwaysEnabled)
    .map(({ installName, origin }) => ({
      force: true,
      installName,
      skipInstall: true,
      source: resolvePath(repoRoot, origin.path),
    })),
});
