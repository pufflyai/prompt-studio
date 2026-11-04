import { join, resolve } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import { apiLogger } from "../../lib/logger";
import { getExtensionCatalog } from "./extension-catalog";

export class AlwaysEnabledExtensionError extends Error {
  constructor() {
    super("This extension is required by the host and must stay enabled in every project.");
    this.name = "AlwaysEnabledExtensionError";
  }
}

export const isAlwaysEnabledExtensionSource = async (source: { install_name: string; source_path: string }) => {
  const expectedPath = join(resolvePstdioHome(), "extensions", source.install_name);
  if (resolve(source.source_path) !== resolve(expectedPath)) return false;
  try {
    const catalog = await getExtensionCatalog();
    return catalog.extensions.some((entry) => entry.installName === source.install_name && entry.alwaysEnabled);
  } catch (error) {
    // Without a readable catalog the host cannot know its policy. Extension sync and user choices keep
    // working; the policy applies again once the catalog loads.
    apiLogger.warn({ err: error, event: "extension.catalog.unavailable" }, "Extension catalog unavailable");
    return false;
  }
};
