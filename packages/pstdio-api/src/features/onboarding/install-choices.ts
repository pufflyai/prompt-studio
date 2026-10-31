import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import type { ExtensionInstallations } from "../../services/extension-installations";
import type { createExtensionService } from "../../services/extension-service";
import { installMissingDefaultExtensions, registerInstalledExtensionSources } from "../extensions/default-extensions";
import { packagedExtensionCatalog } from "../extensions/extension-catalog";
import { getInstalledOnboardingSources } from "./installed-extensions";

export const createOnboardingInstaller =
  (input: {
    extensionService: ReturnType<typeof createExtensionService>;
    installedExtensionSourcesService: Pick<ReturnType<typeof createInstalledExtensionSourcesDBService>, "list">;
    releaseRef?: string;
  }) =>
  async (installName: string, signal?: AbortSignal, projectId?: string) => {
    const entry = packagedExtensionCatalog.extensions.find((entry) => entry.installName === installName);
    if (!entry) throw new Error(`Unknown setup extension: ${installName}`);
    const extensionId = entry.extensionId ?? `pstdio.${installName}`;
    let installed = (await getInstalledOnboardingSources(input.installedExtensionSourcesService)).find(
      (source) => source.extension_id === extensionId,
    );
    if (!installed) {
      const sources = await installMissingDefaultExtensions({
        signal,
        installNames: [installName],
        releaseRef: input.releaseRef,
        forceSourceDefaults: process.env.PSTDIO_DISABLE_EMBED_MANIFEST === "1",
      });
      await registerInstalledExtensionSources(input.extensionService, sources);
      installed = (await getInstalledOnboardingSources(input.installedExtensionSourcesService)).find(
        (source) => source.extension_id === extensionId,
      );
    }
    signal?.throwIfAborted();
    if (!projectId) return;
    let selected = (await input.extensionService.listProjectExtensionInstances(projectId)).find(
      ({ installedSource }) => installedSource.extension_id === extensionId,
    );
    if (!selected && installed) {
      selected =
        (await input.extensionService.attachRegisteredSourceForProject({
          projectId,
          installedSourceId: installed.id,
        })) ?? undefined;
    }
    if (!selected) throw new Error(`Setup extension is unavailable: ${installName}`);
    if (!selected.instance.enabled) await input.extensionService.setProjectExtensionEnabled(selected.instance.id, true);
  };

export const enqueueOnboardingExtension = async (
  jobs: ExtensionInstallations,
  installName: string,
  projectId?: string,
) => {
  const entry = packagedExtensionCatalog.extensions.find((entry) => entry.installName === installName);
  if (!entry) throw new Error(`Unknown setup extension: ${installName}`);
  jobs.enqueueCatalog({
    installName,
    displayName: entry.displayName,
    extensionId: entry.extensionId ?? `pstdio.${installName}`,
    projectId,
  });
  // The queue owns restart recovery; saving preferences must not create a second install owner.
  await jobs.flush();
};
