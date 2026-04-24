import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const EXTENSION_FILE = "extension.ts";

export const localExtensionsDir = (projectRoot: string) => join(projectRoot, ".pstdio", "extensions");

export const discoverExtensionFiles = (projectRoot: string) => {
  const extensionsDir = localExtensionsDir(projectRoot);
  if (!existsSync(extensionsDir)) return [];

  return readdirSync(extensionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(extensionsDir, entry.name, EXTENSION_FILE))
    .filter((filePath) => existsSync(filePath))
    .sort();
};
