import { isLocalizedString, type NavigationTargetPage, type PageLocation, type PageRef } from "@pstdio/sdk/extensions";
import type { NavigationTreeRegistry } from "../../registries/navigation/navigation-tree-registry";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRegistry,
  WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createDisposable } from "../../shared/disposable";
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
    const item: WorkbenchBreadcrumbItem = {
      title: location.resource?.label ?? (page ? pageTitle(page) : location.page.id),
      icon: location.resource?.icon ?? page?.icon,
      ...(leavesProjectNavigation(location, input) ? { startsLevel: true } : {}),
      ...(location.resource ? { resource: input.resources.normalize(location.resource) } : {}),
    };
    // Collection pages return to their landing panel; resource crumbs keep their resource link.
    const landingPanel =
      page?.main.kind === "panels" && !location.resource
        ? page.slots.find(
            (slot) => slot.region === "main" && slot.item.kind === "view" && slot.item.presence === "fixed",
          )
        : undefined;
    if (index < locations.length - 1 || (landingPanel && input.openPanel)) {
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
  sync();
  return createDisposable(() => {
    subscription.dispose();
    ownedBreadcrumbs?.dispose();
  });
};
