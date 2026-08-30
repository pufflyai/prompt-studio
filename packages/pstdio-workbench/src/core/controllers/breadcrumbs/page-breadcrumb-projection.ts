import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { workbenchPageLocationRouteKey, workbenchPageRefKey } from "../page-location/page-location-normalization";
export interface WorkbenchPageBreadcrumbItem {
  title: unknown;
  icon?: string;
  onClick?: () => void;
  location: PageLocation;
  routeKey: string;
}

export interface CreateWorkbenchPageBreadcrumbItemsInput {
  location: PageLocation;
  pages: readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
  navigate(location: PageLocation): void;
}

const pageForLocation = (pages: readonly WorkbenchPageContribution[], location: PageLocation) => {
  const page = pages.find((candidate) => workbenchPageRefKey(candidate.ref) === workbenchPageRefKey(location.page));
  if (!page) throw new Error(`Unknown breadcrumb page: ${workbenchPageRefKey(location.page)}`);
  return page;
};

const locationChain = (location: PageLocation) => {
  const chain: PageLocation[] = [];
  let current: PageLocation | undefined = location;
  while (current) {
    chain.unshift(current);
    current = current.parent;
  }
  return chain;
};

export const createWorkbenchPageBreadcrumbItems = (
  input: CreateWorkbenchPageBreadcrumbItemsInput,
): WorkbenchPageBreadcrumbItem[] => {
  const seen = new Set<string>();
  const entries = locationChain(input.location).flatMap((location) => {
    const routeKey = workbenchPageLocationRouteKey(location, input.resources);
    if (seen.has(routeKey)) return [];
    seen.add(routeKey);
    return [{ location, routeKey, page: pageForLocation(input.pages, location) }];
  });

  return entries.map(({ location, routeKey, page }, index) => ({
    title: location.resource?.label ?? location.resource?.id ?? page.title,
    ...(page.icon ? { icon: page.icon } : {}),
    location,
    routeKey,
    ...(index < entries.length - 1 ? { onClick: () => input.navigate(location) } : {}),
  }));
};
