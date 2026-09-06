import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";

export const setResourceBreadcrumb = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const location = ctx.pages.store.getState().location;
  if (!location?.resource) return;
  ctx.pageLocations.replay({ ...location, resource: resource });
};

// A save can change only the display title of the open resource. Update the
// leaf crumb in place so the ancestor trail survives; rebuilding from the live
// resource object can drop ancestors when its hierarchy metadata was reduced
// in transit.
export const updateResourceBreadcrumbLabel = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  setResourceBreadcrumb(ctx, resource);
};
