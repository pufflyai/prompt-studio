import { isLocalizedString, type NavigationTargetPage, type PageLocation, type PageRef } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import type { NavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import { isSingleViewPage } from "../../registries/pages/page-main";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRegistry,
  WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createDisposable } from "../../shared/disposable";
import type { WorkbenchCore } from "../../workbench-core-types";
import type { WorkbenchBreadcrumbController, WorkbenchBreadcrumbItem } from "../breadcrumbs/breadcrumb-registry";
import { leavesProjectNavigation, type NavigationLevelModes } from "./navigation-level";
import type { WorkbenchPageLocationController } from "./page-location-controller";

const pageRefKey = (ref: PageRef) => `${ref.extensionId ?? ""}:${ref.id}`;
const locationsFromRoot = (location: PageLocation): PageLocation[] =>
  location.parent ? [...locationsFromRoot(location.parent), location] : [location];
const targetFromLocation = (location: PageLocation): NavigationTargetPage => ({
  kind: "page",
  page: location.page,
  ...(location.resource ? { resource: location.resource } : {}),
  ...(location.section ? { section: location.section } : {}),
  ...(location.params ? { params: location.params } : {}),
  ...(location.parent ? { parent: targetFromLocation(location.parent) } : {}),
});
const pageTitle = (page: WorkbenchPageContribution) => {
  if (page.title === undefined) return page.ref.id;
  if (!isLocalizedString(page.title)) return page.title;
  return page.title.default ?? page.title.$l10n;
};
const placeholderBreadcrumb = (page: WorkbenchPageContribution | undefined, isEmptyCurrentPage: boolean) => {
  const empty = page?.main.empty;
  return isEmptyCurrentPage && empty && "view" in empty ? empty.breadcrumb : undefined;
};
const resourceSubpage = (location: PageLocation, resources: WorkbenchPageResourceCodec) => {
  const parent = location.parent;
  return Boolean(
    location.resource &&
      parent?.resource &&
      pageRefKey(location.page) !== pageRefKey(parent.page) &&
      resources.toUri(resources.normalize(location.resource)) === resources.toUri(resources.normalize(parent.resource)),
  );
};
const breadcrumbPresentation = (
  location: PageLocation,
  page: WorkbenchPageContribution | undefined,
  resources: WorkbenchPageResourceCodec,
) => {
  const isResourceSubpage = resourceSubpage(location, resources);
  return {
    title: (!isResourceSubpage && location.resource?.label) || (page ? pageTitle(page) : location.page.id),
    icon: isResourceSubpage ? (page?.icon ?? location.resource?.icon) : (location.resource?.icon ?? page?.icon),
  };
};
export const createWorkbenchPageBreadcrumbItems = (input: {
  location: PageLocation;
  layout: WorkbenchLayout;
  pages: readonly WorkbenchPageContribution[];
  navigationTrees: NavigationTreeRegistry;
  modes: NavigationLevelModes;
  resources: WorkbenchPageResourceCodec;
  navigate(target: NavigationTargetPage): void;
  openPanel?(pageId: string, slotId: string): void;
}): WorkbenchBreadcrumbItem[] => {
  const pagesByRef = new Map(input.pages.map((page) => [pageRefKey(page.ref), page]));
  const locations = locationsFromRoot(input.location);
  return locations.map((location, index) => {
    const page = pagesByRef.get(pageRefKey(location.page));
    const hasPageContent = isSingleViewPage(page) && (!page?.resource || Boolean(location.resource));
    const presentation = placeholderBreadcrumb(
      page,
      index === locations.length - 1 && !hasPageContent && input.layout.regions.main.widgets.length === 0,
    );
    const base = breadcrumbPresentation(location, page, input.resources);
    const item: WorkbenchBreadcrumbItem = {
      title: presentation?.label ?? base.title,
      icon: presentation?.icon ?? base.icon,
      ...(presentation?.menu ? { menu: presentation.menu } : {}),
      ...(leavesProjectNavigation(location, input) ? { startsLevel: true } : {}),
      ...(!presentation && location.resource ? { resource: input.resources.normalize(location.resource) } : {}),
    };
    // Collection pages return to their landing panel; resource crumbs keep their resource link.
    const landingPanel =
      page?.main.kind === "panels" && !location.resource
        ? page.slots.find((slot) => page.main.kind === "panels" && slot.id === page.main.landing)
        : undefined;
    const independentLanding =
      page?.main.kind === "panels" && page.main.landing && typeof page.main.landing !== "string";
    if (index < locations.length - 1 || (landingPanel && input.openPanel) || independentLanding) {
      item.onClick = () => {
        input.navigate(targetFromLocation(location));
        if (page && landingPanel) input.openPanel?.(page.id, landingPanel.id);
      };
    }
    return item;
  });
};
export const setWorkbenchPageBreadcrumbs = (input: {
  breadcrumbs: WorkbenchBreadcrumbController;
  location: PageLocation;
  layout: WorkbenchLayout;
  pages: readonly WorkbenchPageContribution[];
  navigationTrees: NavigationTreeRegistry;
  modes: NavigationLevelModes;
  resources: WorkbenchPageResourceCodec;
  navigate(target: NavigationTargetPage): void;
  openPanel?(pageId: string, slotId: string): void;
}) => input.breadcrumbs.setItems(createWorkbenchPageBreadcrumbItems(input));
export const connectWorkbenchPageBreadcrumbs = (input: {
  breadcrumbs: WorkbenchBreadcrumbController;
  locations: WorkbenchPageLocationController;
  pages: WorkbenchPageRegistry<unknown>;
  navigationTrees: NavigationTreeRegistry;
  modes: NavigationLevelModes;
  resources: WorkbenchPageResourceCodec;
  layout: WorkbenchCore["layout"];
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
      layout: input.layout.getLayout(),
      pages: Object.values(state.pages),
      navigationTrees: input.navigationTrees,
      modes: input.modes,
      resources: input.resources,
      navigate: (target) => {
        input.locations.navigate(target);
      },
      openPanel: (pageId, slotId) => input.pages.openSlot({ pageId, slotId }),
    });
  };
  const subscription = getWorkbenchPageRegistryInternals(input.pages).onDidCommit(sync);
  const unsubscribeLayout = input.layout.store.subscribeSelector(
    (state) => state.layout.regions.main.widgets.length,
    sync,
  );
  sync();
  return createDisposable(() => {
    subscription.dispose();
    unsubscribeLayout();
    ownedBreadcrumbs?.dispose();
  });
};
