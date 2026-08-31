import {
  type ResourceRef as ExtensionResourceRef,
  isLocalizedString,
  type NavigationTargetPage,
  type PageLocation,
  type PageRef,
} from "@pstdio/sdk/extensions";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRegistry,
  WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry";
import type { ResourceRegistry } from "../../registries/resources/resource-registry";
import type { WorkbenchViewRegistry } from "../../registries/views/view-registry";
import { createDisposable } from "../../shared/disposable";
import {
  createResourceBreadcrumbItems,
  type WorkbenchBreadcrumbController,
  type WorkbenchBreadcrumbItem,
} from "../breadcrumbs/breadcrumb-registry";
import { toWorkbenchPageResource } from "../page-runtime/page-runtime";
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

export const createWorkbenchPageBreadcrumbItems = (input: {
  location: PageLocation;
  pages: readonly WorkbenchPageContribution[];
  navigate(target: NavigationTargetPage): void;
}): WorkbenchBreadcrumbItem[] => {
  const pagesByRef = new Map(input.pages.map((page) => [pageRefKey(page.ref), page]));
  const locations = locationsFromRoot(input.location);

  return locations.map((location, index) => {
    const page = pagesByRef.get(pageRefKey(location.page));
    const item: WorkbenchBreadcrumbItem = {
      title: location.resource?.label ?? (page ? pageTitle(page) : location.page.id),
      icon: page?.icon,
    };
    if (index < locations.length - 1) {
      item.onClick = () => input.navigate(targetFromLocation(location));
    }
    return item;
  });
};

const sameBreadcrumbRoot = (left: WorkbenchBreadcrumbItem | undefined, right: WorkbenchBreadcrumbItem | undefined) =>
  left !== undefined && right !== undefined && Object.is(left.title, right.title);

const pageResourceFromWorkbench = (
  resource: NonNullable<WorkbenchBreadcrumbItem["resource"]>,
  codec: WorkbenchPageResourceCodec,
): ExtensionResourceRef => {
  const decoded = codec.fromUri(resource.uri);
  return {
    type: decoded?.type ?? resource.kind,
    id: decoded?.id ?? resource.id ?? resource.uri,
    ...(resource.label ? { label: resource.label } : {}),
    ...(resource.metadata ? { metadata: resource.metadata as ExtensionResourceRef["metadata"] } : {}),
  };
};

export const setWorkbenchPageBreadcrumbs = (input: {
  breadcrumbs: WorkbenchBreadcrumbController;
  location: PageLocation;
  pages: readonly WorkbenchPageContribution[];
  pageResources: WorkbenchPageResourceCodec;
  resources: ResourceRegistry;
  views: WorkbenchViewRegistry;
  navigate(target: NavigationTargetPage): void;
}) => {
  const pageItems = createWorkbenchPageBreadcrumbItems(input);
  if (!input.location.resource) return input.breadcrumbs.setItems(pageItems);

  const pageParents = pageItems.slice(0, -1);
  const resource = toWorkbenchPageResource(input.location.resource, input.pageResources);
  const resourceItems = createResourceBreadcrumbItems(input.resources, resource, input.views).map(
    (item, index, items) => {
      const itemResource = item.resource;
      if (!itemResource || index === items.length - 1) return item;
      return {
        ...item,
        onClick: () =>
          input.navigate({
            kind: "page",
            page: input.location.page,
            resource: pageResourceFromWorkbench(itemResource, input.pageResources),
          }),
      };
    },
  );
  const firstResourceIndex = sameBreadcrumbRoot(pageParents.at(-1), resourceItems[0]) ? 1 : 0;
  return input.breadcrumbs.setItems([...pageParents, ...resourceItems.slice(firstResourceIndex)]);
};

export const connectWorkbenchPageBreadcrumbs = (input: {
  breadcrumbs: WorkbenchBreadcrumbController;
  locations: WorkbenchPageLocationController;
  pages: WorkbenchPageRegistry<unknown>;
  pageResources: WorkbenchPageResourceCodec;
  resources: ResourceRegistry;
  views: WorkbenchViewRegistry;
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
      pageResources: input.pageResources,
      resources: input.resources,
      views: input.views,
      navigate: (target) => {
        input.locations.navigate(target);
      },
    });
  };

  const subscriptions = [
    input.pages.store.subscribe(sync),
    input.resources.store.subscribe(sync),
    input.views.store.subscribe(sync),
  ];
  sync();
  return createDisposable(() => {
    for (const unsubscribe of subscriptions) unsubscribe();
    ownedBreadcrumbs?.dispose();
  });
};
