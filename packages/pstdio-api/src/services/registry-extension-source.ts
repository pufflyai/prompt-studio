import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createRegistryClient, parseRegistrySourceRef } from "pstdio-extensions/distribution";
import type { ExtensionCatalogEntry } from "../features/extensions/extension-catalog";
import type { InstallExtensionSourceInput } from "../features/extensions/install-extension-source";
import type { ExtensionUpgradeServiceDeps } from "./extension-upgrade-service";

export interface RegistryUpgradeSource {
  source_kind?: string;
  source_ref: string | null;
  version?: string | null;
}
export const createRegistryExtensionSource = (
  deps: Pick<ExtensionUpgradeServiceDeps, "release">,
  install: NonNullable<ExtensionUpgradeServiceDeps["installExtensionSource"]>,
) => {
  const registryFor = (source?: RegistryUpgradeSource) => {
    const recorded = parseRegistrySourceRef(source?.source_ref);
    if (recorded) return { registry: recorded.registry, id: recorded.id, version: recorded.version };
    return null;
  };
  const installRelease = async (id: string, registry: string, options: Omit<InstallExtensionSourceInput, "source">) => {
    const client = createRegistryClient(registry);
    const release = await client.latest(id, EXTENSION_API_VERSION, options.signal);
    return install({
      ...options,
      source: id,
      installName: options.installName ?? id,
      prepareNamedSource: (_name, tempDir, _ref, signal) => client.prepare(release, join(tempDir, "package"), signal),
    });
  };
  const hasNewerRelease = async (registry: string, id: string, installedVersion: string) => {
    try {
      const release = await createRegistryClient(registry).latest(id, EXTENSION_API_VERSION);
      return Bun.semver.order(release.version, installedVersion) > 0;
    } catch {
      // Keep the action available so an explicit request can explain a connection or API mismatch.
      return true;
    }
  };
  return {
    matches: (source: RegistryUpgradeSource) => registryFor(source) !== null,
    canUpgrade: async (source: RegistryUpgradeSource) => {
      const recorded = registryFor(source);
      if (!recorded) return false;
      return hasNewerRelease(recorded.registry, recorded.id, source.version ?? recorded.version);
    },
    canUpgradeCatalog: async (entry: ExtensionCatalogEntry, installedVersion: string) => {
      if (deps.release?.source !== "registry" || !entry.extensionId) return false;
      return hasNewerRelease(deps.release.ref.slice(4), entry.extensionId, installedVersion);
    },
    installRecorded: (source: RegistryUpgradeSource, options: Omit<InstallExtensionSourceInput, "source">) => {
      const recorded = registryFor(source);
      if (!recorded) throw new Error("Extension has no registry source");
      return installRelease(recorded.id, recorded.registry, options);
    },
    installCatalog: (entry: ExtensionCatalogEntry, options: Omit<InstallExtensionSourceInput, "source">) => {
      if (deps.release?.source !== "registry" || !entry.extensionId) throw new Error("No registry catalog source");
      return installRelease(entry.extensionId, deps.release.ref.slice(4), options);
    },
  };
};
