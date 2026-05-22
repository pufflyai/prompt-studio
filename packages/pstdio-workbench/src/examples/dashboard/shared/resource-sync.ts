import type { ResourceRef, WorkbenchModuleContributionContext } from "../../../core";
import { dashboardWidgetIds } from "./widget-ids";

// A resource opens with the resource sidebar (ticket/workspace) instead of a
// navigation mode tree.
export const shouldShowResourceSidebar = (resource: ResourceRef) =>
  resource.kind === "ticket" || resource.kind === "workspace";

// Pins the resource sidebar tree to the left area and selects the open resource.
export const syncResourceSidebar = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.layout.clearArea("left");
  ctx.layout.openWidget(dashboardWidgetIds.ticketSidebar, { resource, title: resource.label, pinned: true });
  ctx.renderers.setSelectedNode(dashboardWidgetIds.ticketSidebar, resource.uri);
  ctx.renderers.refresh(dashboardWidgetIds.ticketSidebar);
  ctx.layout.setAreaVisible("left", true);
  ctx.panels.setOpen("left", true);
};

// The default breadcrumb trail: a single entry for the open resource. Slices
// with nested resources (workspaces) build richer trails themselves.
export const setResourceBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.breadcrumbs.setItems([{ title: resource.label ?? "Dashboard", icon: resource.icon, resource }]);
};
