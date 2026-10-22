import { join, resolve } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import { loadExtensionCatalog } from "./extension-catalog";

export class AlwaysEnabledExtensionError extends Error {
  constructor() {
    super("This extension is required by the host and must stay enabled in every project.");
    this.name = "AlwaysEnabledExtensionError";
  }
}

export const isAlwaysEnabledExtensionSource = async (source: { install_name: string; source_path: string }) => {
  const expectedPath = join(resolvePstdioHome(), "extensions", source.install_name);
  if (resolve(source.source_path) !== resolve(expectedPath)) return false;
  const catalog = await loadExtensionCatalog();
  return catalog.extensions.some((entry) => entry.installName === source.install_name && entry.alwaysEnabled);
};
