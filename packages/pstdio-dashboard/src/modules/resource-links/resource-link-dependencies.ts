import { matchesQueryDependency, type QueryChangeEnvelope, type ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";

export const createResourceLinkDependencies = (ctx: WorkbenchModuleContext, source: ResourceRef) => {
  const resolvedOwners = new Set<string>();
  let unknownOwner = !source.extensionId;
  return {
    resolved(resources: readonly ResourceRef[]) {
      for (const resource of resources) {
        if (!resource.extensionId || resolvedOwners.size >= 128) unknownOwner = true;
        else resolvedOwners.add(resource.extensionId);
      }
    },
    matches(event: QueryChangeEnvelope) {
      if (!matchesQueryDependency(event, { projectId: source.projectId })) return false;
      if (!event.extensionId || unknownOwner) return true;
      if (source.extensionId === event.extensionId || resolvedOwners.has(event.extensionId)) return true;
      return ctx.commandPaletteResources
        .listProviders()
        .some((provider) => !provider.extensionId || provider.extensionId === event.extensionId);
    },
  };
};
