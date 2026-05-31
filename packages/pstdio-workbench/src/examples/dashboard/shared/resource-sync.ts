import type { ResourceRef, WorkbenchModuleContributionContext } from "../../../core";
import { dashboardWidgetIds } from "./widget-ids";

// Pins the resource sidebar tree to the left area as the single left projection.
// The sidebar's body and selection follow the PRIMARY resource (see resource-sidebar-tree
// getBody + the workspaces module's onDidChangePrimaryResource subscription), so this only
// owns left-area mutual exclusion and visibility. The resource is still passed so the global
// active-resource signal lands on the opened resource.
export const syncResourceSidebar = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.layout.clearArea("left");
  ctx.layout.openWidget(dashboardWidgetIds.ticketSidebar, { resource, title: resource.label, pinned: true });
  ctx.layout.setAreaVisible("left", true);
  ctx.panels.setOpen("left", true);
};

// The default breadcrumb trail: a single entry for the open resource. Slices
// with nested resources (workspaces) build richer trails themselves.
export const setResourceBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.breadcrumbs.setItems([{ title: resource.label ?? "Dashboard", icon: resource.icon, resource }]);
};
