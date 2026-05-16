import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";

export const pstdioHomeRoot = () => resolvePstdioHome();

export const pstdioExtensionsRoot = () => join(pstdioHomeRoot(), "extensions");

/**
 * Walks each subdirectory of `extensionsDir`. The manifest reader validates
 * whether each directory is a valid extension package downstream.
 */
export const discoverExtensionPackages = (extensionsDir: string) => {
  if (!existsSync(extensionsDir)) return [];

  return readdirSync(extensionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(extensionsDir, entry.name))
    .sort();
};

export const discoverExtensionPackagesInUserRoot = () => discoverExtensionPackages(pstdioExtensionsRoot());
