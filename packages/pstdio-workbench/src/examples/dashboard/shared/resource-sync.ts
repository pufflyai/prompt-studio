import type { ResourceRef, WorkbenchModuleContributionContext } from "../../../core";
import { dashboardWidgetIds } from "./widget-ids";

// Pins the resource tree to the Sidenav as its single projection.
// The sidenav's body and selection follow the PRIMARY resource (see resource-sidenav-tree
// getBody + the workspaces module's onDidChangePrimaryResource subscription), so this only
// owns left-region mutual exclusion and visibility. The resource is still passed so the global
// active-resource signal lands on the opened resource.
export const syncResourceSidenav = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.layout.clearRegion("sidenav");
  ctx.layout.openWidget(dashboardWidgetIds.ticketSidenav, { resource, title: resource.label, pinned: true });
  ctx.layout.setRegionVisible("sidenav", true);
  ctx.panels.setOpen("sidenav", true);
};

// The default breadcrumb trail: a single entry for the open resource. Slices
// with nested resources (workspaces) build richer trails themselves.
export const setResourceBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.breadcrumbs.setItems([{ title: resource.label ?? "Dashboard", icon: resource.icon, resource }]);
};
