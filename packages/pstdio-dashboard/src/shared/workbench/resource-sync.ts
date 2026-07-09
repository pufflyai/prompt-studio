import type { ResourceRef, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";

// The default breadcrumb trail: a single entry for the open resource. Slices
// with nested resources build richer trails themselves.
export const setResourceBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.breadcrumbs.setItems([{ title: resource.label ?? "Dashboard", icon: resource.icon, resource }]);
};
