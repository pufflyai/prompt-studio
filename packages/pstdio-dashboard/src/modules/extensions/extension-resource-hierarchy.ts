import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { dashboardResourceParent, normalizeExtensionHierarchyReference } from "@/shared/workbench/resource-hierarchy";

export const registerExtensionResourceHierarchy = (
  ctx: WorkbenchModuleContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
): Disposable => {
  const ownerId = input.metadata.extensions[0]?.id ?? input.metadata.views[0]?.extensionId ?? "unknown";

  return ctx.resources.registerHierarchyProvider({
    id: `dashboard.extensions.resource-hierarchy.${input.projectId}.${ownerId}`,
    priority: 100,
    canResolve: (resource) => Boolean(normalizeExtensionHierarchyReference(resource.metadata?.resourceParent)),
    getParent: (resource) => dashboardResourceParent(ctx, resource, input.projectId),
  });
};
