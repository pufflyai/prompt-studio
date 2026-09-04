import { isLocalizedString, type NavigationTargetPage, type PageLocation, type PageRef } from "@pstdio/sdk/extensions";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRegistry,
  WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry";
import { createDisposable } from "../../shared/disposable";
import type { WorkbenchBreadcrumbController, WorkbenchBreadcrumbItem } from "../breadcrumbs/breadcrumb-registry";
import type { WorkbenchPageLocationController } from "./page-location-controller";

const pageRefKey = (ref: PageRef) => `${ref.extensionId ?? ""}:${ref.id}`;

const locationsFromRoot = (location: PageLocation): PageLocation[] =>
  location.parent ? [...locationsFromRoot(location.parent), location] : [location];

const targetFromLocation = (location: PageLocation): NavigationTargetPage => ({
  kind: "page",
  page: location.page,
  ...(location.resource ? { resource: location.resource } : {}),
  ...(location.section ? { section: location.section } : {}),
  ...(location.parent ? { parent: targetFromLocation(location.parent) } : {}),
});

const pageTitle = (page: WorkbenchPageContribution) => {
  if (page.title === undefined) return page.ref.id;
  if (!isLocalizedString(page.title)) return page.title;
  return page.title.default ?? page.title.$l10n;
};

const toBreadcrumbResource = (
  resource: NonNullable<PageLocation["resource"]>,
  resources: WorkbenchPageResourceCodec,
) => {
  const normalized = resources.normalize(resource);
  return {
    kind: normalized.type,
    uri: resources.toUri(normalized),
    id: normalized.id,
    label: normalized.label,
    metadata: normalized.metadata,
  };
};

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
      title: location.resource?.label ?? (page ? pageTitle(page) : location.page.id),
      icon: page?.icon,
      ...(location.resource ? { resource: toBreadcrumbResource(location.resource, input.resources) } : {}),
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
  let ownedBreadcrumbs: { dispose(): void } | undefined;
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

  const subscriptions = [input.pages.store.subscribe(sync)];
  sync();
  return createDisposable(() => {
    for (const unsubscribe of subscriptions) unsubscribe();
    ownedBreadcrumbs?.dispose();
  });
};
