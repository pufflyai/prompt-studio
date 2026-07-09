import type { WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import {
  createDashboardExtensionRouteResource,
  dashboardExtensionRouteKind,
} from "@/shared/extensions/workbench-extension-contributions";

const restoreActiveWidget = (ctx: WorkbenchModuleContributionContext, widgetId: string | undefined) => {
  if (!widgetId) return;

  try {
    ctx.layout.activateWidget(widgetId);
  } catch {
    // Metadata refresh can race with the user closing the active widget.
  }
};

export const refreshOpenExtensionRoutes = (
  ctx: WorkbenchModuleContributionContext,
  metadata: ResolvedWorkbenchExtensionMetadata,
  projectId: string,
) => {
  const routeByPath = new Map(metadata.routes.map((route) => [route.path, route]));
  const activeWidgetId = ctx.layout.getLayout().activeWidgetId;

  for (const area of Object.values(ctx.layout.getLayout().areas)) {
    for (const placement of area.widgets) {
      const resource = placement.resource;
      const routeProjectId = resource?.metadata?.projectId;
      const routePath = resource?.metadata?.routePath;

      if (resource?.kind !== dashboardExtensionRouteKind) continue;
      if (routeProjectId !== projectId || typeof routePath !== "string") continue;

      const route = routeByPath.get(routePath);
      if (!route) continue;

      const nextResource = createDashboardExtensionRouteResource({ icon: resource.icon, projectId, route });
      ctx.layout.openWidget(placement.contributionId, {
        resource: nextResource,
        title: nextResource.label,
      });
    }
  }

  restoreActiveWidget(ctx, activeWidgetId);
};
