import type { ResourceRef, WorkbenchModuleContributionContext } from "../../../core";
import { dashboardWidgetIds } from "./widget-ids";

// Pins the resource tree to the Sidebar as its single projection.
// The sidebar's body and selection follow the PRIMARY resource (see resource-sidebar-tree
// getBody + the workspaces module's onDidChangePrimaryResource subscription), so this only
// owns left-region mutual exclusion and visibility. The resource is still passed so the global
// active-resource signal lands on the opened resource.
export const syncResourceSidebar = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.layout.clearRegion("sidebar");
  ctx.layout.openWidget(dashboardWidgetIds.ticketSidebar, { resource, title: resource.label, pinned: true });
  ctx.layout.setRegionVisible("sidebar", true);
  ctx.panels.setOpen("sidebar", true);
};

// The default breadcrumb trail: a single entry for the open resource. Slices
// with nested resources (workspaces) build richer trails themselves.
export const setResourceBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.breadcrumbs.setItems([{ title: resource.label ?? "Dashboard", icon: resource.icon, resource }]);
};
