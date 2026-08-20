import type { OpenResourceInput, ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { extensionViewWidgetIdFor } from "./extension-view-placement";

export const openExtensionPanelResource = (
  ctx: WorkbenchModuleContext,
  resource: ResourceRef,
  openInput: OpenResourceInput,
  fallbackProjectId: string | undefined,
) => {
  const projectId = typeof resource.metadata?.projectId === "string" ? resource.metadata.projectId : fallbackProjectId;
  const panel = getCachedDashboardExtensionMetadata(projectId)?.panels.find(
    (candidate) => candidate.id === resource.id,
  );
  if (!panel) throw new Error(`Extension view is not available: ${resource.id}`);

  const navigationModeId =
    typeof resource.metadata?.navigationModeId === "string" ? resource.metadata.navigationModeId : undefined;
  selectDashboardNavigationResource(ctx, resource, { modeId: navigationModeId });
  setResourceBreadcrumb(ctx, resource);
  if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
    ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, resource.uri);
  }

  // No region: the panel widget already carries its own docking region, so a direct
  // open lands where the panel declares it belongs.
  return ctx.layout.openPanel(extensionViewWidgetIdFor(panel), {
    strategy: openInput.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
    resource,
    title: resource.label,
  });
};
