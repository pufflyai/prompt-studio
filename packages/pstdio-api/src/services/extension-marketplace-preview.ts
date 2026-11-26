import { join } from "node:path";
import type { ExtensionCatalogEntry } from "../features/extensions/extension-catalog";
import {
  type InstallExtensionSourceInput,
  type InstalledExtensionSource,
  resolvePstdioHome,
} from "../features/extensions/install-extension-source";
import type { ExtensionUpgradeServiceDeps } from "./extension-upgrade-service";
import type { createRegistryExtensionSource } from "./registry-extension-source";

export const createExtensionMarketplacePreview = (input: {
  deps: ExtensionUpgradeServiceDeps;
  install: (input: InstallExtensionSourceInput) => Promise<InstalledExtensionSource>;
  registry: ReturnType<typeof createRegistryExtensionSource>;
  requireCatalogEntry: (installName: string) => Promise<ExtensionCatalogEntry>;
  releaseRefFor: (entry: ExtensionCatalogEntry) => string;
}) => {
  const { deps, install, registry, requireCatalogEntry, releaseRefFor } = input;
  const previewSources = new Map<string, ReturnType<typeof install>>();
  return async (installName: string) => {
    const entry = await requireCatalogEntry(installName);
    if (deps.release?.source === "registry" && entry.extensionId) {
      return registry.installCatalog(entry, {
        env: {
          ...process.env,
          PSTDIO_HOME: join(resolvePstdioHome({ env: process.env }), "cache", "extension-previews"),
        },
        installName,
        force: true,
      });
    }
    const existing = previewSources.get(installName);
    if (existing) return existing;

    const releaseRef = releaseRefFor(entry);
    const previewHome = join(
      resolvePstdioHome({ env: process.env }),
      "cache",
      "extension-catalog",
      encodeURIComponent(`${entry.origin.url}@${releaseRef}`),
    );
    const workspaceSource = deps.release?.source === "workspace" && entry.origin.ref === "{hostRelease}";
    const source =
      workspaceSource && deps.release?.source === "workspace"
        ? join(deps.release.root, entry.origin.path)
        : installName;
    const preview = install({
      env: { ...process.env, PSTDIO_HOME: previewHome },
      source,
      installName,
      force: true,
      ...(workspaceSource ? { skipInstall: true } : { hostReleaseRef: deps.release?.ref }),
      repoPath: join(previewHome, "repo"),
      reuseInstalledDependencies: true,
    }).catch((error) => {
      if (previewSources.get(installName) === preview) previewSources.delete(installName);
      throw error;
    });
    previewSources.set(installName, preview);
    return preview;
  };
};
