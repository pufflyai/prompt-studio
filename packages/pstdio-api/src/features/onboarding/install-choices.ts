import type { ExtensionInstallations } from "../../services/extension-installations";
import type { createExtensionService } from "../../services/extension-service";
import type { createProjectService } from "../../services/project-service";
import {
  installMissingDefaultExtensions,
  registerInstalledExtensionSources,
  syncInstalledExtensionsForProjects,
} from "../extensions/default-extensions";
import { packagedExtensionCatalog } from "../extensions/extension-catalog";

export const createOnboardingInstaller =
  (input: {
    extensionService: ReturnType<typeof createExtensionService>;
    projectService: ReturnType<typeof createProjectService>;
    releaseRef?: string;
  }) =>
  async (installName: string, signal?: AbortSignal) => {
    const entry = packagedExtensionCatalog.extensions.find((entry) => entry.installName === installName);
    if (!entry) throw new Error(`Unknown setup extension: ${installName}`);
    const sources = await installMissingDefaultExtensions({
      signal,
      installNames: [installName],
      releaseRef: input.releaseRef,
      forceSourceDefaults: process.env.PSTDIO_DISABLE_EMBED_MANIFEST === "1",
    });
    await registerInstalledExtensionSources(input.extensionService, sources);
    await syncInstalledExtensionsForProjects(input);
    for (const project of await input.projectService.list()) {
      signal?.throwIfAborted();
      const selected = (await input.extensionService.listProjectExtensionInstances(project.id)).find(
        ({ installedSource }) => installedSource.install_name === installName,
      );
      if (selected && !selected.instance.enabled)
        await input.extensionService.setProjectExtensionEnabled(selected.instance.id, true);
    }
  };

export const enqueueOnboardingExtension = (jobs: ExtensionInstallations, installName: string) => {
  const entry = packagedExtensionCatalog.extensions.find((entry) => entry.installName === installName);
  if (!entry) throw new Error(`Unknown setup extension: ${installName}`);
  jobs.enqueueCatalog({
    installName,
    displayName: entry.displayName,
    extensionId: entry.extensionId ?? `pstdio.${installName}`,
  });
};
