import { createResourceBreadcrumbItems, type ResourceRef, type WorkbenchModuleContext } from "@pstdio/workbench";

export const setResourceBreadcrumb = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  ctx.breadcrumbs.setItems(createResourceBreadcrumbItems(ctx.resources, resource, ctx.views));
};

// A save can change only the display title of the open resource. Update the
// leaf crumb in place so the ancestor trail survives; rebuilding from the live
// resource object can drop ancestors when its hierarchy metadata was reduced
// in transit.
export const updateResourceBreadcrumbLabel = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const items = ctx.breadcrumbs.getItems();
  const leaf = items?.at(-1);
  if (items && leaf?.resource?.uri === resource.uri) {
    ctx.breadcrumbs.setItems([...items.slice(0, -1), { ...leaf, title: resource.label ?? leaf.title, resource }]);
    return;
  }
  setResourceBreadcrumb(ctx, resource);
};
