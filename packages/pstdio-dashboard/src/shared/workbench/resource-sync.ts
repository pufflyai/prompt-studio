import {
  collectResourceAncestors,
  type ResourceRef,
  type WorkbenchModuleContributionContext,
} from "@pstdio/workbench/core";

export const setResourceBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  const ancestors = collectResourceAncestors(ctx.resources.getResource, resource).reverse();
  ctx.breadcrumbs.setItems([
    ...ancestors.map((ancestor) => ({
      title: ancestor.label ?? ancestor.id ?? ancestor.kind,
      icon: ancestor.icon,
      resource: ancestor,
      onClick: () => void ctx.resources.openResource(ancestor, { replaceActive: true }),
    })),
    { title: resource.label ?? resource.id ?? "Dashboard", icon: resource.icon, resource },
  ]);
};
