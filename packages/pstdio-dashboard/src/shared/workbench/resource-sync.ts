import { createResourceBreadcrumbItems, type ResourceRef, type WorkbenchModuleContext } from "@pstdio/workbench";

export const setResourceBreadcrumb = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  ctx.breadcrumbs.setItems(createResourceBreadcrumbItems(ctx.resources, resource));
};
