import { basename, dirname, join, resolve } from "node:path";
import { createExtensionUpgradePool } from "pstdio-api-contracts/extension-host";
import type { createInstalledExtensionSourcesDBService, createPreferencesDBService } from "pstdio-db";
import { parseRegistrySourceRef } from "pstdio-extensions/distribution";
import { extensionUpgradeConcurrency } from "pstdio-extensions/preparation-client";
import { resolvePstdioHome } from "pstdio-paths";
import {
  getExtensionCatalog,
  packagedExtensionCatalog,
  selectExtensionCatalogEntry,
} from "../features/extensions/extension-catalog";
import { hashExtensionSourceAsync } from "../features/extensions/extension-runtime";
import { compatibilityError } from "../features/extensions/project-extension-instance";
import { parseExtensionSourceRef } from "../services/extension-source-ref";
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
    const trusted = selectExtensionCatalogEntry(packagedExtensionCatalog, source.install_name);
    const selected = selectExtensionCatalogEntry(catalog, source.install_name);
    if (
      !trusted ||
      !selected ||
      trusted.origin.url !== "https://github.com/pufflyai/prompt-studio" ||
      trusted.origin.ref !== "{hostRelease}" ||
      selected.origin.url !== trusted.origin.url ||
      selected.origin.path !== trusted.origin.path ||
      selected.origin.ref !== trusted.origin.ref ||
      source.extension_id !== (trusted.extensionId ?? `pstdio.${trusted.installName}`)
    )
      return;
    const registry = parseRegistrySourceRef(source.source_ref);
    const git = parseExtensionSourceRef(source.source_ref);
    if (
      !(source.source_kind === "git" && git?.url === trusted.origin.url && git.path === trusted.origin.path) &&
      !(
        source.source_kind === "registry" &&
        registry?.id === source.extension_id &&
        registry.registry === service.registry
      )
    )
      return;
    if (!service.releaseRef) throw new Error("A host release is required to upgrade first-party tools");
    const parent = dirname(resolve(source.source_path));
    const global = join(resolvePstdioHome({ env: process.env }), "extensions");
    if (parent !== global && (basename(parent) !== "extensions" || basename(dirname(parent)) !== ".pstdio")) return;
    if (!source.source_hash || (await hashExtensionSourceAsync(source.source_path)) !== source.source_hash) return;
    const result = await service.upgradeInstalled(source, parent === global ? undefined : dirname(dirname(parent)));
    if (compatibilityError(result.installedSource))
      throw new Error(`Updated tool is still incompatible: ${source.extension_id}`);
  };
  const pool = createExtensionUpgradePool(extensionUpgradeConcurrency);
  const results = await Promise.allSettled(
    row.value.map((id) =>
      pool(async () => {
        const source = await sources.get(id);
        if (source) await upgrade(source);
      }),
    ),
  );
  const failed = results.find((r) => r.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  await preferences.remove(pending);
}
