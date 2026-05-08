import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";

const EXTENSION_FILE = "extension.ts";

export const pstdioHomeRoot = () => resolvePstdioHome();

export const pstdioExtensionsRoot = () => join(pstdioHomeRoot(), "extensions");

export const discoverExtensionFilesInDir = (extensionsDir: string) => {
  if (!existsSync(extensionsDir)) return [];

  return readdirSync(extensionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(extensionsDir, entry.name, EXTENSION_FILE))
    .filter((filePath) => existsSync(filePath))
    .sort();
};

export const discoverExtensionFiles = () => discoverExtensionFilesInDir(pstdioExtensionsRoot());
