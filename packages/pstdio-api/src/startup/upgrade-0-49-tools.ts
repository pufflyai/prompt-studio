import { basename, dirname, join, resolve } from "node:path";
import type { createInstalledExtensionSourcesDBService, createPreferencesDBService } from "pstdio-db";
import { resolvePstdioHome } from "pstdio-paths";
import { getExtensionCatalog } from "../features/extensions/extension-catalog";
import { hashExtensionSourceAsync } from "../features/extensions/extension-runtime";
import { isManagedCatalogSource } from "../features/extensions/managed-catalog-source";
import { compatibilityError } from "../features/extensions/project-extension-instance";
import type { createExtensionUpgradeService } from "../services/extension-upgrade-service";

const pending = {
  scope: "global",
  scope_id: "global",
  extension_id: "",
  key: "upgrade_0_49_first_party_tools",
} as const;
type Source = NonNullable<Awaited<ReturnType<ReturnType<typeof createInstalledExtensionSourcesDBService>["get"]>>>;

/** The embedded first-party catalog and the recorded origin must name the same source. */
export async function upgrade049Tools(
  preferences: Pick<ReturnType<typeof createPreferencesDBService>, "get" | "remove">,
  sources: Pick<ReturnType<typeof createInstalledExtensionSourcesDBService>, "get">,
  service: Pick<ReturnType<typeof createExtensionUpgradeService>, "upgradeInstalled" | "registry" | "releaseRef">,
) {
  const row = await preferences.get(pending);
  if (!row) return;
  if (!Array.isArray(row.value) || !row.value.every((id) => typeof id === "string"))
    throw new Error("Invalid 0.49 tool upgrade list");
  const catalog = await getExtensionCatalog();
  const upgrade = async (source: Source) => {
    if (!compatibilityError(source)) return;
    if (!isManagedCatalogSource(source, catalog, service.registry)) return;
    if (!service.releaseRef) throw new Error("A host release is required to upgrade first-party tools");
    const parent = dirname(resolve(source.source_path));
    const global = join(resolvePstdioHome({ env: process.env }), "extensions");
    if (parent !== global && (basename(parent) !== "extensions" || basename(dirname(parent)) !== ".pstdio")) return;
    if (!source.source_hash || (await hashExtensionSourceAsync(source.source_path)) !== source.source_hash) return;
    const result = await service.upgradeInstalled(source, parent === global ? undefined : dirname(dirname(parent)));
    if (compatibilityError(result.installedSource))
      throw new Error(`Updated tool is still incompatible: ${source.extension_id}`);
  };
  // The preparation worker pool schedules bounded installs. Keep it fed while earlier
  // tools register and dispose of their previous sources.
  const results = await Promise.allSettled(
    row.value.map(async (id) => {
      const source = await sources.get(id);
      if (source) await upgrade(source);
    }),
  );
  const failed = results.find((r) => r.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  await preferences.remove(pending);
}
