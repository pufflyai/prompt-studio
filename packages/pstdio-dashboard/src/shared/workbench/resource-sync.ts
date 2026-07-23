import type { ResourceRef, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";

// The default breadcrumb trail: a single entry for the open resource. Slices
// with nested resources build richer trails themselves.
export const setResourceBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  ctx.breadcrumbs.setItems([{ title: resource.label ?? "Dashboard", icon: resource.icon, resource }]);
};

export const appendResourceBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  const current = ctx.breadcrumbs.getItems() ?? [];
  const parent = current.at(-1);
  const parentResource = parent?.resource;

  ctx.breadcrumbs.setItems([
    ...current.slice(0, -1),
    ...(parent
      ? [
          {
            ...parent,
            ...(parentResource
              ? {
                  onClick: () => void ctx.resources.openResource(parentResource, { replaceActive: true }),
                }
              : {}),
          },
        ]
      : []),
    { title: resource.label ?? resource.kind, icon: resource.icon, resource },
  ]);
};
