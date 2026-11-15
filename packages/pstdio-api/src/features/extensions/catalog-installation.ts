import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import type { ExtensionInstallations } from "../../services/extension-installations";
import type { createExtensionService } from "../../services/extension-service";
import type { createExtensionUpgradeService } from "../../services/extension-upgrade-service";
import { installMissingDefaultExtensions, registerInstalledExtensionSources } from "./default-extensions";
import { findExtensionCatalogEntry } from "./extension-catalog";
import { toExtensionEnableInput } from "./install-extension-source";
import { getInstalledUserSources } from "./installed-user-extensions";

export const createCatalogInstaller =
  (input: {
    extensionService: ReturnType<typeof createExtensionService>;
    installedExtensionSourcesService: Pick<ReturnType<typeof createInstalledExtensionSourcesDBService>, "list">;
    extensionUpgradeService: Pick<ReturnType<typeof createExtensionUpgradeService>, "installSource">;
    releaseRef?: string;
  }) =>
  async (installName: string, signal: AbortSignal, projectId: string) => {
    const entry = await findExtensionCatalogEntry(installName);
    if (!entry) throw new Error(`Unknown catalog extension: ${installName}`);
    const extensionId = entry.extensionId ?? `pstdio.${installName}`;
    let installed = (await getInstalledUserSources(input.installedExtensionSourcesService)).find(
      (source) => source.extension_id === extensionId,
    );
    if (!installed) {
      await installMissingDefaultExtensions({
        registerInstalledSources: (sources) => registerInstalledExtensionSources(input.extensionService, sources),
        signal,
        installNames: [installName],
        releaseRef: input.releaseRef,
        forceSourceDefaults: process.env.PSTDIO_DISABLE_EMBED_MANIFEST === "1",
      });
      installed = (await getInstalledUserSources(input.installedExtensionSourcesService)).find(
        (source) => source.extension_id === extensionId,
      );
    }
    signal.throwIfAborted();
    let selected = (await input.extensionService.listProjectExtensionInstances(projectId)).find(
      ({ installedSource }) => installedSource.extension_id === extensionId,
    );
    if (!selected && !installed) {
      const source = await input.extensionUpgradeService.installSource(projectId, {
        source: { kind: "catalog", name: installName },
      });
      signal.throwIfAborted();
      selected = await input.extensionService.enableInstalledSourceForProject({
        projectId,
        installName: source.installName,
        ...toExtensionEnableInput(source),
      });
    }
    if (!selected && installed) {
      selected =
        (await input.extensionService.attachRegisteredSourceForProject({
          projectId,
          installedSourceId: installed.id,
        })) ?? undefined;
    }
    if (!selected) throw new Error(`Catalog extension is unavailable: ${installName}`);
    if (!selected.instance.enabled) await input.extensionService.setProjectExtensionEnabled(selected.instance.id, true);
  };

/** Validates every name before accepting any, then returns once the selections are durable. */
export const enqueueCatalogExtensions = async (
  jobs: ExtensionInstallations,
  installNames: string[],
  projectId: string,
) => {
  const entries = await Promise.all(
    [...new Set(installNames)].map(async (installName) => {
      const entry = await findExtensionCatalogEntry(installName);
      if (!entry) throw new Error(`Unknown catalog extension: ${installName}`);
      return { installName, entry };
    }),
  );
  for (const { installName, entry } of entries)
    jobs.enqueue({
      installName,
      displayName: entry.displayName,
      extensionId: entry.extensionId ?? `pstdio.${installName}`,
      projectId,
    });
  await jobs.flush();
};
