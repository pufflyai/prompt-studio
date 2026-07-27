import type { Disposable, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { dashboardResourceParent } from "@/shared/workbench/resource-hierarchy";
import { createExtensionKanbanRendererResource } from "./extension-kanban-renderer-resource";

export const registerExtensionResourceHierarchy = (
  ctx: WorkbenchModuleContributionContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
): Disposable => {
  const hierarchyRenderers = input.metadata.kanbanRenderers?.filter((renderer) => renderer.resourceKind) ?? [];
  const rootsByKind = new Map(
    hierarchyRenderers.map((renderer) => [
      renderer.resourceKind!,
      createExtensionKanbanRendererResource(renderer, input.projectId),
    ]),
  );
  const ownerId = [...new Set(hierarchyRenderers.map((renderer) => renderer.extensionId))].sort().join("+") || "none";

  return ctx.resources.registerHierarchyProvider({
    id: `dashboard.extensions.resource-hierarchy.${input.projectId}.${ownerId}`,
    priority: 100,
    canResolve: (resource) => rootsByKind.has(resource.kind),
    getParent: (resource) => dashboardResourceParent(ctx, resource, input.projectId) ?? rootsByKind.get(resource.kind),
  });
};
