import { existsSync } from "node:fs";
import { resolveCatalogIcon } from "./catalog-icon";
import type { ExtensionsRouteDeps } from "./deps";
import { getExtensionCatalog } from "./extension-catalog";
import { hashExtensionSourceAsync } from "./extension-runtime";
import { toProjectExtensionInstance } from "./project-extension-instance";

export const listProjectExtensionInventory = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const records = await deps.extensionService.listProjectExtensionInstances(projectId);
  // Uninstall retains data-bearing rows for same-path restore. A retained row alone
  // does not mean the package is still installed.
  const installedRecords = records.filter(({ installedSource }) => existsSync(installedSource.source_path));
  const extensions = await Promise.all(
    installedRecords.map(async ({ instance, installedSource }) =>
      toProjectExtensionInstance(
        instance,
        installedSource,
        await hashExtensionSourceAsync(installedSource.source_path),
        {
          canUpgrade: await deps.extensionUpgradeService?.canUpgrade(installedSource),
        },
      ),
    ),
  );
  const installedNames = new Set(installedRecords.map(({ installedSource }) => installedSource.install_name));
  const installedIds = new Set(installedRecords.map(({ installedSource }) => installedSource.extension_id));
  const catalog = await getExtensionCatalog();
  const releaseRef = deps.extensionUpgradeService?.registry ? undefined : deps.extensionUpgradeService?.releaseRef;
  const marketplace = await Promise.all(
    catalog.extensions
      .filter((extension) => extension.listed !== false)
      .map(async (extension) => ({
        installName: extension.installName,
        extensionId: extension.extensionId,
        icon: await resolveCatalogIcon(extension),
        displayName: extension.displayName,
        description: extension.description,
        origin: {
          kind: extension.origin.kind,
          path: extension.origin.path,
          // Catalog entries that follow the host release show the release they install.
          ref: extension.origin.ref === "{hostRelease}" ? (releaseRef ?? extension.origin.ref) : extension.origin.ref,
          url: extension.origin.url,
        },
        publisher: extension.extensionId?.split(".")[0] ?? extension.publisher,
        registry:
          deps.extensionUpgradeService?.registry && extension.extensionId
            ? { url: deps.extensionUpgradeService.registry, extensionId: extension.extensionId }
            : undefined,
        installed:
          installedNames.has(extension.installName) ||
          Boolean(extension.extensionId && installedIds.has(extension.extensionId)),
      })),
  );
  return { extensions, marketplace };
};
