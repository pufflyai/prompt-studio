import { basename, join, resolve } from "node:path";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { ExtensionCatalog } from "../features/extensions/extension-catalog";
import {
  ExtensionUpgradeNeedsReviewError,
  rememberedReleaseFingerprint,
} from "../features/extensions/extension-upgrade-baseline";
import { resolvePstdioHome } from "../features/extensions/install-extension-source";
import { isManagedCatalogSource, trustedCatalogEntry } from "../features/extensions/managed-catalog-source";
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

export const legacyCatalogFingerprint = (
  source: Pick<
    UpgradeInstance["installedSource"],
    "install_name" | "extension_id" | "source_kind" | "source_ref" | "source_path"
  >,
  catalog: ExtensionCatalog,
  home = resolvePstdioHome({ env: process.env }),
) => {
  if (source.source_kind !== "local_path" || source.source_ref) return;
  const entry = trustedCatalogEntry(source, catalog);
  if (!entry || resolve(source.source_path) !== join(home, "extensions", basename(entry.origin.path))) return;
  return rememberedReleaseFingerprint(home, source.source_path);
};

export const localUpgradeFingerprint = async (
  current: UpgradeInstance,
  local: UpgradeInstance | undefined,
  catalog: Promise<ExtensionCatalog>,
  home?: string,
) => {
  const fingerprint =
    !local || local.instance.id === current.instance.id
      ? legacyCatalogFingerprint(current.installedSource, await catalog, home)
      : undefined;
  if (local && !fingerprint)
    throw new ExtensionUpgradeNeedsReviewError(
      `Choose which version of ${local.installedSource.display_name} to use in this project.`,
    );
  return fingerprint;
};
