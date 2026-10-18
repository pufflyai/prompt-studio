import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey, reconcileOwnedPlacements } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";

type State = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;

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
  resourceKey(next.location?.resource) !== resourceKey(previous.location?.resource);

const sharedKeys = (layout: WorkbenchLayout | undefined, main: boolean) =>
  new Set(
    Object.values(layout?.regions ?? {}).flatMap((region) =>
      region.widgets.flatMap((widget) =>
        (region.id === "main") === main && widget.placementIdentity?.kind !== "page" && widget.placementIdentity
          ? [placementIdentityKey(widget.placementIdentity)]
          : [],
      ),
    ),
  );

export const scopePageMainTabs = (input: {
  state: State;
  previous: State;
  layout: WorkbenchLayout;
  pageLayout?: WorkbenchLayout;
  modeLayout?: WorkbenchLayout;
  isRegistered(contributionId: string): boolean;
}) => {
  const { state, previous, layout, pageLayout, modeLayout } = input;
  if (!state.activePageId || !pageContextChanged(state, previous)) return state;
  const departing = sharedKeys(layout, true);
  const shared = sharedKeys(modeLayout, false);
  const activated = new Set(state.reconciliation.activate.map((entry) => placementIdentityKey(entry.identity)));
  let placements = state.placements.filter((entry) => {
    const key = placementIdentityKey(entry.identity);
    return !departing.has(key) || shared.has(key) || activated.has(key);
  });
  for (const [order, widget] of (pageLayout?.regions.main.widgets ?? []).entries()) {
    const identity = widget.placementIdentity;
    if (!identity || identity.kind === "page" || !input.isRegistered(widget.contributionId)) continue;
    const key = placementIdentityKey(identity);
    if (shared.has(key)) continue;
    const existing = placements.find((entry) => placementIdentityKey(entry.identity) === key);
    placements = placements.filter((entry) => placementIdentityKey(entry.identity) !== key);
    placements.push({
      identity,
      region: "main",
      order,
      value: activated.has(key) && existing ? existing.value : widget,
    });
  }
  return {
    ...state,
    placements,
    reconciliation: reconcileOwnedPlacements({
      current: previous.placements,
      desired: placements,
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
