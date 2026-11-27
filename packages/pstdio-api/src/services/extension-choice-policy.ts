import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";
import { AlwaysEnabledExtensionError } from "../features/extensions/always-on-extensions";

export type ExtensionChoicePolicy = {
  isProjectExtensionManaged?: (projectId: string, extensionId: string) => Promise<boolean>;
};

export const createExtensionChoicePolicy = (
  deps: ExtensionChoicePolicy & {
    extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
    installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  },
) => {
  const assertProjectChoice = async (projectId: string, extensionId: string) => {
    if (await deps.isProjectExtensionManaged?.(projectId, extensionId))
      throw new AlwaysEnabledExtensionError("This extension is managed by your team owner and must stay enabled.");
  };
  const assertInstalledSourceChoice = async (sourceId: string) => {
    const source = await deps.installedExtensionSourcesService.get(sourceId);
    if (!source) return;
    for (const instance of await deps.extensionInstancesService.list({ installed_extension_id: sourceId }))
      if (instance.scope_type === "project") await assertProjectChoice(instance.scope_id, source.extension_id);
  };
  return { assertProjectChoice, assertInstalledSourceChoice };
};
