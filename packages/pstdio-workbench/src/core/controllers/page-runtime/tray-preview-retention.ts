import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { indexCurrentOwnedPlacements, renderDesiredPlacements } from "../../registries/layout/owned-placement-layout";
import { placementIdentityKey, reconcileOwnedPlacements } from "../../registries/layout/placement-reconciliation";
import { planTrayTabs } from "../../registries/layout/tray-tabs";
import { editPagePlacementStates } from "../../registries/pages/page-placement-state";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";

type State = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
export const retainTrayPreviews = (
  state: State,
  previous: State,
  current: WorkbenchLayout,
  modeLayout?: WorkbenchLayout,
) => {
  const rendered = renderDesiredPlacements(
    { layout: current, modeLayout, placements: state.placements },
    indexCurrentOwnedPlacements(current),
  );
  const incoming = [
    ...state.reconciliation.activate,
    ...state.reconciliation.add,
    ...state.reconciliation.update.map((entry) => entry.desired),
  ];
  const preferred = incoming
    .filter((entry) => entry.value.tabRetention === "preview")
    .map((entry) => placementIdentityKey(entry.identity));
  const removed = new Set<string>();
  for (const region of Object.values(current.regions)) {
    const candidates = rendered.filter((entry) => entry.region === region.id);
    const preferredEntry = preferred
      .map((key) => candidates.find((entry) => placementIdentityKey(entry.identity) === key))
      .find(Boolean);
    const plan = planTrayTabs(
      candidates.map((entry) => entry.placement),
      preferredEntry?.placement.widgetId ?? region.activeWidgetId,
    );
    for (const widget of plan.replaced)
      if (widget.placementIdentity) removed.add(placementIdentityKey(widget.placementIdentity));
  }
  return removeTrayPreviews(state, previous, removed);
};

export const removeTrayPreviews = (state: State, previous: State, removed: ReadonlySet<string>) => {
  if (!removed.size) return state;
  const placements = state.placements.filter((entry) => !removed.has(placementIdentityKey(entry.identity)));
  let pageStates = state.pageStates;
  for (const entry of state.placements) {
    const identity = entry.identity;
    if (identity.kind !== "page" || !removed.has(placementIdentityKey(identity))) continue;
    pageStates = editPagePlacementStates(pageStates, identity, { kind: "close" });
  }
  return {
    ...state,
    placements,
    pageStates,
    reconciliation: reconcileOwnedPlacements({
      current: previous.placements,
      desired: placements,
      activate: state.reconciliation.activate
        .filter((entry) => !removed.has(placementIdentityKey(entry.identity)))
        .map((entry) => entry.identity),
      valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    }),
  };
};
