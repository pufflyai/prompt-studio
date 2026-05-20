import type { OpenResourceInput, ResourceRef, WorkbenchModuleContributionContext } from "pstdio-workbench/core";

// Opening any dashboard surface follows the same shape: reveal the surface
// widget for the resource and reflect the resource in the breadcrumb trail.
export const openSurfaceWidget = (
  ctx: WorkbenchModuleContributionContext,
  widgetId: string,
  resource: ResourceRef,
  input: OpenResourceInput,
) => {
  ctx.breadcrumbs.setItems([{ title: resource.label ?? "Dashboard", icon: resource.icon, resource }]);
  return ctx.layout.openWidget(widgetId, {
    resource,
    title: resource.label,
    replaceActive: input.replaceActive,
  });
};
