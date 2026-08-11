import type { WorkbenchModuleContext } from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import {
  createDashboardExtensionRouteResource,
  dashboardExtensionRouteKind,
} from "@/shared/extensions/workbench-extension-contributions";

const restoreActiveWidget = (ctx: WorkbenchModuleContext, panelId: string | undefined) => {
  if (!panelId) return;

  try {
    ctx.layout.activatePanel(panelId);
  } catch {
    // Metadata refresh can race with the user closing the active widget.
  }
};

export const refreshOpenExtensionRoutes = (
  ctx: WorkbenchModuleContext,
  metadata: ResolvedWorkbenchExtensionMetadata,
  projectId: string,
) => {
  const routeByPath = new Map(metadata.routes.map((route) => [route.path, route]));
  const activeWidgetId = ctx.layout.getLayout().activeWidgetId;

  for (const region of Object.values(ctx.layout.getLayout().regions)) {
    for (const placement of region.widgets) {
      const resource = placement.resource;
      const routeProjectId = resource?.metadata?.projectId;
      const routePath = resource?.metadata?.routePath;

      if (resource?.kind !== dashboardExtensionRouteKind) continue;
      if (routeProjectId !== projectId || typeof routePath !== "string") continue;

      const route = routeByPath.get(routePath);
      if (!route) continue;

      const nextResource = createDashboardExtensionRouteResource({ icon: resource.icon, projectId, route });
      ctx.layout.openPanel(placement.contributionId, {
        resource: nextResource,
        title: nextResource.label,
        strategy: { kind: "replace-panel", instanceId: placement.widgetId },
      });
    }
  }

  restoreActiveWidget(ctx, activeWidgetId);
};
