import type { ResourceRef, WorkbenchBreadcrumbItem, WorkbenchTabSnapshot } from "../../core";

export const breadcrumbSnapshot = (
  item: WorkbenchBreadcrumbItem,
  current: WorkbenchBreadcrumbItem | undefined,
  resource: ResourceRef | undefined,
  snapshot: WorkbenchTabSnapshot,
  referenceKey: (resource: ResourceRef) => string,
) =>
  item === current && resource && item.resource && referenceKey(item.resource) === referenceKey(resource)
    ? snapshot
    : {};
