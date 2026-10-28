import type { PageLocation, ResourceRef, ViewLocation } from "@pstdio/sdk/extensions";
import { isSingleViewPage } from "./page-main";
import type { WorkbenchPageContribution } from "./page-registry-types";

export const removeLocationResources = (
  location: PageLocation,
  pages: readonly WorkbenchPageContribution[],
  removed: (resource: ResourceRef) => boolean,
): PageLocation => {
  const parent = location.parent ? removeLocationResources(location.parent, pages, removed) : undefined;
  const next = parent === location.parent ? location : { ...location, parent };
  if (!next.resource || !removed(next.resource)) return next;
  const page = pages.find((page) => page.ref.id === next.page.id && page.ref.extensionId === next.page.extensionId);
  if (isSingleViewPage(page) && page?.main.empty) {
    const { resource: _resource, section: _section, position: _position, ...landing } = next;
    return landing;
  }
  return parent ?? { page: next.page };
};

export const removeViewContextResources = <Value extends ViewLocation>(
  value: Value,
  pages: readonly WorkbenchPageContribution[],
  removed: (resource: ResourceRef) => boolean,
) => {
  const context = value.pageContext;
  if (!context?.parent) return value;
  const parent = removeLocationResources(context.parent, pages, removed);
  return parent === context.parent ? value : { ...value, pageContext: { ...context, parent } };
};
