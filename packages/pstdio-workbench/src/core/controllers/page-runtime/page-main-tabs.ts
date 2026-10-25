import { resourceKey } from "@pstdio/sdk/extensions";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchWidgetPlacement,
} from "../../registries/layout/layout-types";
import { placementIdentityKey, reconcileOwnedPlacements } from "../../registries/layout/placement-reconciliation";
import { isSingleViewPage, pageSlots } from "../../registries/pages/page-main";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { pageResourceContextKey } from "../../registries/pages/page-resource-context";
import { ownsStaticPageInstance } from "../../registries/pages/page-state-key";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import { collectionMainOwner } from "./collection-main-owner";

type State = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;

const pagePlacementClosed = (widget: WorkbenchWidgetPlacement, next: State, previous: State) => {
  const identity = widget.placementIdentity;
  if (identity?.kind !== "page") return false;
  const contains = (key: string, state: State["pageStates"][string] | undefined) =>
    (ownsStaticPageInstance(key, identity.pageId, identity.instanceKey) &&
      state?.openStaticSlotIds.includes(identity.slotId)) ||
    state?.resourceInstances[identity.slotId]?.some((instance) => instance.instanceKey === identity.instanceKey);
  return Object.entries(previous.pageStates).some(
    ([key, state]) =>
      (key === identity.pageId || key.startsWith(`${identity.pageId}|`)) &&
      contains(key, state) &&
      !contains(key, next.pageStates[key]),
  );
};

export const pageLayoutContext = (state: State) => ({
  projectId: state.projectId,
  modeId: state.activeModeId,
  pageId: state.activePageId,
  resource: state.location?.resource,
});

export const pageContextChanged = (next: State, previous: State) =>
  next.projectId !== previous.projectId ||
  next.activeModeId !== previous.activeModeId ||
  next.activePageId !== previous.activePageId ||
  pageResourceContextKey(next.pages[next.activePageId ?? ""], next.location?.resource) !==
    pageResourceContextKey(previous.pages[previous.activePageId ?? ""], previous.location?.resource);

const sharedKeys = (layout: WorkbenchLayout | undefined, main: boolean) =>
  new Set(
    Object.values(layout?.regions ?? {}).flatMap((region) =>
      region.widgets.flatMap((widget) =>
        (region.id === "main") === main && widget.placementIdentity
          ? [placementIdentityKey(widget.placementIdentity)]
          : [],
      ),
    ),
  );

interface PageTabsInput {
  state: State;
  previous: State;
  layout: WorkbenchLayout;
  pageLayout?: WorkbenchLayout;
  modeLayout?: WorkbenchLayout;
  getWidget(contributionId: string): RegisteredWidgetContribution | undefined;
}

const mainTabNeedsCache = (widget: WorkbenchWidgetPlacement, state: State, changingPage: boolean) => {
  const identity = widget.placementIdentity;
  if (!identity) return false;
  if (identity.kind !== "page") return changingPage;
  if (identity.pageId !== state.activePageId) return true;
  const page = state.pages[identity.pageId];
  const slot = page && pageSlots(page).find((slot) => slot.id === identity.slotId);
  const constraint = slot?.item.kind === "binding" ? slot.item.binding : page?.resource;
  // A changed declaration must not restore a resource that its slot no longer accepts.
  if (constraint && (!widget.resource || !resourceMatchesConstraint(constraint, widget.resource))) return false;
  return Boolean(
    page?.resource &&
      pageResourceContextKey(page, widget.resource) !== pageResourceContextKey(page, state.location?.resource),
  );
};

/** True when a tab is content of the active page and resource, not one a shared tray retained. */
export const belongsToActivePageContext = (widget: WorkbenchWidgetPlacement, state: State) => {
  const identity = widget.placementIdentity;
  if (identity?.kind !== "page" || identity.pageId !== state.activePageId) return false;
  const page = state.pages[identity.pageId];
  // Slot views of other resource kinds, such as a workspace's files, live inside the current page resource.
  if (!page?.resource || !widget.resource || !resourceMatchesConstraint(page.resource, widget.resource)) return true;
  return pageResourceContextKey(page, widget.resource) === pageResourceContextKey(page, state.location?.resource);
};

const restoreMainTabs = (input: PageTabsInput, current: State["placements"], shared: ReadonlySet<string>) => {
  const { state, previous, layout, pageLayout } = input;
  const changingPage = pageContextChanged(state, previous);
  const activated = new Set(state.reconciliation.activate.map((entry) => placementIdentityKey(entry.identity)));
  let placements = [...current];
  let main = changingPage ? pageLayout?.regions.main.widgets : layout.regions.main.widgets;
  if (isSingleViewPage(state.pages[state.activePageId ?? ""])) main = [];
  for (const [order, widget] of (main ?? []).entries()) {
    const identity = widget.placementIdentity;
    if (!identity || !input.getWidget(widget.contributionId) || pagePlacementClosed(widget, state, previous)) continue;
    if (!mainTabNeedsCache(widget, state, changingPage)) continue;
    const key = placementIdentityKey(identity);
    if (shared.has(key)) continue;
    const existing = placements.find((entry) => placementIdentityKey(entry.identity) === key);
    placements = placements.filter((entry) => placementIdentityKey(entry.identity) !== key);
    const value = activated.has(key) && existing ? existing.value : refreshPageTab(input, widget);
    placements.push({
      identity,
      region: "main",
      order,
      // Another page's primary view is an ordinary tab here. As a Location it would
      // own this page's resource context and hide the page's own tabs.
      value:
        value.role === "location" && identity.kind === "page" && identity.pageId !== state.activePageId
          ? { ...value, role: "sub-panel" as const }
          : value,
    });
  }
  return placements;
};

const refreshPageTab = (input: PageTabsInput, widget: WorkbenchWidgetPlacement) => {
  // Declarations own close behavior; a saved layout only owns the tab's placement.
  widget = { ...widget, closable: input.getWidget(widget.contributionId)?.closable ?? widget.closable };
  const identity = widget.placementIdentity;
  if (identity?.kind !== "page" || !widget.resource) return widget;
  const instance = Object.entries(input.state.pageStates)
    .filter(([key]) => key === identity.pageId || key.startsWith(`${identity.pageId}|`))
    .flatMap(([, page]) => page.resourceInstances[identity.slotId] ?? [])
    .find(
      (entry) =>
        entry.instanceKey === identity.instanceKey && resourceKey(entry.resource) === resourceKey(widget.resource),
    );
  if (!instance) return widget;
  return {
    ...widget,
    resource: instance.resource,
    section: instance.section,
    position: instance.position,
    pageContext: instance.pageContext,
    title: instance.resource.label ?? input.getWidget(widget.contributionId)?.title ?? widget.title,
  };
};

const sharedPageTabValue = (input: PageTabsInput, widget: WorkbenchWidgetPlacement) => {
  const key = placementIdentityKey(widget.placementIdentity!);
  const explicit = [
    ...input.state.reconciliation.activate,
    ...input.state.reconciliation.update.map((entry) => entry.desired),
  ].find((entry) => placementIdentityKey(entry.identity) === key);
  return explicit ? { ...explicit.value, widgetId: widget.widgetId } : refreshPageTab(input, widget);
};

const canRestoreSharedPageTab = (input: PageTabsInput, widget: WorkbenchWidgetPlacement, leavingPage: boolean) => {
  const identity = widget.placementIdentity;
  return (
    identity?.kind === "page" &&
    Boolean(input.getWidget(widget.contributionId)) &&
    input.state.pages[identity.pageId]?.modeId === input.state.activeModeId &&
    !(leavingPage && widget.tabRetention === "preview") &&
    !pagePlacementClosed(widget, input.state, input.previous)
  );
};

const restoreSharedPageTabs = (input: PageTabsInput, current: State["placements"], sharedLayout?: WorkbenchLayout) => {
  const { state, previous } = input;
  const leavingPage =
    pageContextChanged(state, previous) &&
    state.projectId === previous.projectId &&
    state.activeModeId === previous.activeModeId;
  let placements = [...current];
  // A placement's owner creates its content; its actual tray determines its
  // navigation lifetime. Page-created tabs in Side/Bottom share the mode too.
  for (const region of Object.values(sharedLayout?.regions ?? {})) {
    if (region.id !== "side" && region.id !== "secondary") continue;
    for (const [order, widget] of region.widgets.entries()) {
      const identity = widget.placementIdentity;
      if (!identity || !canRestoreSharedPageTab(input, widget, leavingPage)) continue;
      const key = placementIdentityKey(identity);
      placements = placements.filter((entry) => placementIdentityKey(entry.identity) !== key);
      placements.push({ identity, region: region.id, order, value: sharedPageTabValue(input, widget) });
    }
  }
  return placements;
};

export const scopePageMainTabs = (input: PageTabsInput) => {
  const { state, previous, layout, modeLayout } = input;
  if (!state.activePageId) return state;
  const changingPage = pageContextChanged(state, previous);
  const sameMode = state.projectId === previous.projectId && state.activeModeId === previous.activeModeId;
  const sharedLayout = sameMode ? layout : modeLayout;
  const pages = Object.values(state.pages);
  const owner = collectionMainOwner(state.pages[state.activePageId], pages);
  // A collection and its detail routes keep one Main tray, so their tabs never depart it.
  const sameTray =
    sameMode &&
    owner?.main.kind === "panels" &&
    !owner.resource &&
    owner === collectionMainOwner(previous.pages[previous.activePageId ?? ""], pages);
  const departing = previous.activePageId && !sameTray ? sharedKeys(layout, true) : new Set<string>();
  const shared = sharedKeys(sharedLayout, false);
  const activated = new Set(state.reconciliation.activate.map((entry) => placementIdentityKey(entry.identity)));
  const retained = state.placements.filter((entry) => {
    const key = placementIdentityKey(entry.identity);
    return !changingPage || !departing.has(key) || shared.has(key) || activated.has(key);
  });
  const placements = restoreSharedPageTabs(input, restoreMainTabs(input, retained, shared), sharedLayout);
  return {
    ...state,
    placements,
    reconciliation: reconcileOwnedPlacements({
      current: previous.placements,
      desired: placements,
      destinations: state.reconciliation.destinations,
      activate: state.reconciliation.activate
        .filter((entry) =>
          placements.some(
            (candidate) => placementIdentityKey(candidate.identity) === placementIdentityKey(entry.identity),
          ),
        )
        .map((entry) => entry.identity),
      valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    }),
  };
};
