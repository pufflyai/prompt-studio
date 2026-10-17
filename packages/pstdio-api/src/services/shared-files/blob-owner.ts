import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";

export const createBlobOwnerResolver =
  (deps: {
    extensionInstancesDBService: Pick<ReturnType<typeof createExtensionInstancesDBService>, "get" | "list">;
    installedExtensionSourcesDBService: Pick<ReturnType<typeof createInstalledExtensionSourcesDBService>, "get">;
  }) =>
  async (input: { project_id: string; extension_instance_id: string }) => {
    const instance = await deps.extensionInstancesDBService.get(input.extension_instance_id);
    if (instance) {
      if (instance.scope_type !== "project" || instance.scope_id !== input.project_id) return null;
      const source = await deps.installedExtensionSourcesDBService.get(instance.installed_extension_id);
      return source
        ? { owner: { workbenchId: input.project_id, extensionId: source.extension_id }, instanceId: instance.id }
        : null;
    }
    for (const candidate of await deps.extensionInstancesDBService.list({
      scope_type: "project",
      scope_id: input.project_id,
    })) {
      const source = await deps.installedExtensionSourcesDBService.get(candidate.installed_extension_id);
      if (source?.extension_id === input.extension_instance_id)
        return { owner: { workbenchId: input.project_id, extensionId: source.extension_id }, instanceId: candidate.id };
    }
    return null;
  };
