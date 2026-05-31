import type { ResourceRef, WorkbenchModuleContributionContext } from "pstdio-workbench/core";

export const syncTreeSidebar = (
  ctx: WorkbenchModuleContributionContext,
  treeWidgetId: string,
  resource: ResourceRef,
) => {
  ctx.layout.openWidget(treeWidgetId, { resource, title: resource.label, pinned: true });
  ctx.renderers.setSelectedNode(treeWidgetId, resource.uri);
  ctx.renderers.refresh(treeWidgetId);
  ctx.layout.setAreaVisible("left", true);
  ctx.panels.setOpen("left", true);
};

// The default breadcrumb trail: a single entry for the open resource. Slices
// with nested resources (workspaces) build richer trails themselves.
export const setResourceBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.breadcrumbs.setItems([{ title: resource.label ?? "Dashboard", icon: resource.icon, resource }]);
};
