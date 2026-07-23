import {
  createResourceBreadcrumbItems,
  type ResourceRef,
  type WorkbenchModuleContributionContext,
} from "@pstdio/workbench/core";

export const setResourceBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.breadcrumbs.setItems(createResourceBreadcrumbItems(ctx.resources, resource));
};
