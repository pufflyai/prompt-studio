import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { createElement } from "react";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import {
  buildDashboardExtensionRouteEntries,
  createDashboardExtensionRouteResource,
  dashboardExtensionRouteKind,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { ExtensionRouteWidget } from "./components/extension-route-widget";
import { ExtensionViewWidget } from "./components/extension-view-widget";
import { dashboardExtensionViewKind, extensionViewRegion, extensionViewWidgetIdFor } from "./extension-view-placement";

const resolveAvailableRouteResource = (resource: ResourceRef, fallbackProjectId: string | undefined) => {
  const routeProjectId =
    typeof resource.metadata?.projectId === "string" ? resource.metadata.projectId : fallbackProjectId;
  const routePath = typeof resource.metadata?.routePath === "string" ? resource.metadata.routePath : resource.id;
  const route = getCachedDashboardExtensionMetadata(routeProjectId)?.routes.find(
    (candidate) => candidate.path === routePath,
  );
  if (!route) throw new Error(`Extension route is not available: ${routePath}`);
  if (!routeProjectId) throw new Error(`Extension route has no project: ${routePath}`);
  return createDashboardExtensionRouteResource({ icon: resource.icon, projectId: routeProjectId, route });
};

export const registerExtensionResources = (
  ctx: WorkbenchModuleContext,
  getState: () => { metadata: ResolvedWorkbenchExtensionMetadata | undefined; projectId: string | undefined },
) => {
  ctx.resources.registerKind({ kind: dashboardExtensionRouteKind, label: "Extension route", icon: "PanelLeft" });
  ctx.resources.registerKind({ kind: dashboardExtensionViewKind, label: "Extension view", icon: "PanelLeft" });
  ctx.layout.registerPanel(
    {
      closable: false,
      id: dashboardWidgetIds.extensionRoute,
      title: "Extension route",
      region: "main",
      singleton: true,
      rendererId: dashboardWidgetIds.extensionRoute,
      priority: 70,
    },
    { priority: 70 },
  );
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.extensionRoute,
    render: (input) => createElement(ExtensionRouteWidget, { input }),
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.extensionView,
    render: (input) => createElement(ExtensionViewWidget, { input }),
  });
  ctx.resources.registerProvider({
    id: "dashboard-workbench.extension-routes",
    kind: dashboardExtensionRouteKind,
    list: () => buildDashboardExtensionRouteEntries(getState()),
  });
  ctx.resources.registerPresenter({
    id: "dashboard.extensions.panel-presenter",
    priority: 1000,
    canOpen: (resource) => resource.kind === dashboardExtensionViewKind,
    open: (resource, openInput) => {
      const state = getState();
      const viewProjectId =
        typeof resource.metadata?.projectId === "string" ? resource.metadata.projectId : state.projectId;
      const view = getCachedDashboardExtensionMetadata(viewProjectId)?.panels.find(
        (candidate) => candidate.id === resource.id,
      );
      if (!view) throw new Error(`Extension view is not available: ${resource.id}`);
      selectDashboardNavigationResource(ctx, resource);
      return ctx.layout.openPanel(extensionViewWidgetIdFor(view), {
        strategy: openInput.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
        resource,
        region: extensionViewRegion(view.region),
        title: resource.label,
      });
    },
  });
  ctx.resources.registerPresenter({
    id: "dashboard.extensions.route-presenter",
    priority: 1000,
    canOpen: (resource) => resource.kind === dashboardExtensionRouteKind,
    open: (resource, openInput) => {
      const availableResource = resolveAvailableRouteResource(resource, getState().projectId);
      selectDashboardNavigationResource(ctx, availableResource, { modeId: "project" });
      setResourceBreadcrumb(ctx, availableResource);
      if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
        ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, availableResource.uri);
      }
      return ctx.layout.openPanel(dashboardWidgetIds.extensionRoute, {
        strategy: openInput.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
        resource: availableResource,
        title: availableResource.label,
      });
    },
  });
};
