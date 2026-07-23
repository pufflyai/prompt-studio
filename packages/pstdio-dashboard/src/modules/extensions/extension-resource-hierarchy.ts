import type { Disposable, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { dashboardResourceParent } from "@/shared/workbench/resource-hierarchy";
import { createExtensionDataRendererResource } from "./extension-data-renderer-resource";

export const registerExtensionResourceHierarchy = (
  ctx: WorkbenchModuleContributionContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
): Disposable => {
  const rootsByKind = new Map(
    input.metadata.dataRenderers
      ?.filter((renderer) => renderer.resourceKind)
      .map((renderer) => [renderer.resourceKind!, createExtensionDataRendererResource(renderer, input.projectId)]),
  );

  return ctx.resources.registerHierarchyProvider({
    id: `dashboard.extensions.resource-hierarchy.${input.projectId}`,
    priority: 100,
    canResolve: (resource) => rootsByKind.has(resource.kind),
    getParent: (resource) => dashboardResourceParent(ctx, resource, input.projectId) ?? rootsByKind.get(resource.kind),
  });
};
