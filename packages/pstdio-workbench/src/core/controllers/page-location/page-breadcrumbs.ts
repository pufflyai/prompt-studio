import type { NavigationTargetPage, PageLocation, PageRef } from "@pstdio/sdk/extensions";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRegistry,
  WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createDisposable } from "../../shared/disposable";
import type { WorkbenchBreadcrumbController, WorkbenchBreadcrumbItem } from "../breadcrumbs/breadcrumb-registry";
import type { WorkbenchPageLocationController } from "./page-location-controller";
import { pageLocationTitle, targetFromLocation } from "./page-location-presentation";

const pageRefKey = (ref: PageRef) => `${ref.extensionId ?? ""}:${ref.id}`;
const locationsFromRoot = (location: PageLocation): PageLocation[] =>
  location.parent ? [...locationsFromRoot(location.parent), location] : [location];
export const createWorkbenchPageBreadcrumbItems = (input: {
  location: PageLocation;
  pages: readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
  navigate(target: NavigationTargetPage): void;
}): WorkbenchBreadcrumbItem[] => {
  const pagesByRef = new Map(input.pages.map((page) => [pageRefKey(page.ref), page]));
  const locations = locationsFromRoot(input.location);
  return locations.map((location, index) => {
    const page = pagesByRef.get(pageRefKey(location.page));
    const item: WorkbenchBreadcrumbItem = {
      title: pageLocationTitle(location, input.pages),
      icon: location.resource?.icon ?? page?.icon,
      ...(location.resource ? { resource: input.resources.normalize(location.resource) } : {}),
    };
    if (index < locations.length - 1) {
      item.onClick = () => input.navigate(targetFromLocation(location));
    }
    return item;
  });
};
export const setWorkbenchPageBreadcrumbs = (input: {
  breadcrumbs: WorkbenchBreadcrumbController;
  location: PageLocation;
  pages: readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
  navigate(target: NavigationTargetPage): void;
}) => input.breadcrumbs.setItems(createWorkbenchPageBreadcrumbItems(input));
export const connectWorkbenchPageBreadcrumbs = (input: {
  breadcrumbs: WorkbenchBreadcrumbController;
  locations: WorkbenchPageLocationController;
  pages: WorkbenchPageRegistry<unknown>;
  resources: WorkbenchPageResourceCodec;
}) => {
  let ownedBreadcrumbs:
    | {
        dispose(): void;
      }
    | undefined;
  const sync = () => {
    const state = input.pages.store.getState();
    if (!state.activePageId || !state.location) {
      ownedBreadcrumbs?.dispose();
      ownedBreadcrumbs = undefined;
      return;
    }
    ownedBreadcrumbs?.dispose();
    ownedBreadcrumbs = setWorkbenchPageBreadcrumbs({
      breadcrumbs: input.breadcrumbs,
      location: state.location,
      pages: Object.values(state.pages),
      resources: input.resources,
      navigate: (target) => {
        input.locations.navigate(target);
      },
    });
  };
  const subscription = getWorkbenchPageRegistryInternals(input.pages).onDidCommit(sync);
  sync();
  return createDisposable(() => {
    subscription.dispose();
    ownedBreadcrumbs?.dispose();
  });
};
