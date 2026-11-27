import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { ExtensionCatalog } from "../features/extensions/extension-catalog";
import { isManagedCatalogSource } from "../features/extensions/managed-catalog-source";
import type { ExtensionService } from "./extension-upgrade-service";

export type UpgradeInstance = NonNullable<Awaited<ReturnType<ExtensionService["getProjectExtensionInstance"]>>>;
export const findLocalProvider = async (
  catalog: Promise<ExtensionCatalog>,
  service: ExtensionService,
  projectId: string,
  current: UpgradeInstance,
) => {
  if (current.instance.enabled && current.installedSource.source_kind === "local_path") {
    // Older hosts rediscovered catalog installs as local paths. The normal install
    // still verifies their exact original working tree before replacing any files.
    if (isManagedCatalogSource(current.installedSource, await catalog)) return undefined;
    return current;
  }
  if (current.instance.enabled !== false) return undefined;
  const id = canonicalExtensionId(current.installedSource.extension_id);
  return (await service.listProjectExtensionInstances(projectId)).find(
    ({ instance, installedSource }) =>
      instance.enabled &&
      installedSource.source_kind === "local_path" &&
      canonicalExtensionId(installedSource.extension_id) === id,
  );
};
