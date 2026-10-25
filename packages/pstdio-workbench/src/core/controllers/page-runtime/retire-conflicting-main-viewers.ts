import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey, reconcileOwnedPlacements } from "../../registries/layout/placement-reconciliation";
import { editPagePlacementStates } from "../../registries/pages/page-placement-state";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry-types";
import { departingPagePreviews } from "./page-preview-lifetime";

/** An auxiliary viewer owns its resource; a saved Main tray does not reserve it. */
export const retireConflictingMainViewers = (input: {
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
  previous: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
  sharedLayout?: WorkbenchLayout;
  isResourceViewer(identity: PlacementIdentity): boolean;
  resourceKey(resource: ResourceRef): string;
}) => {
  const { state, previous, sharedLayout } = input;
  const departing = new Set(
    sharedLayout ? departingPagePreviews(state, previous, sharedLayout).map((widget) => widget.widgetId) : [],
  );
  const auxiliary = new Map<string, string>();
  for (const region of ["side", "secondary"] as const) {
    for (const widget of sharedLayout?.regions[region].widgets ?? []) {
      const identity = widget.placementIdentity;
      if (identity && widget.resource && !departing.has(widget.widgetId) && input.isResourceViewer(identity))
        auxiliary.set(input.resourceKey(widget.resource), placementIdentityKey(identity));
    }
  }
  const retired = state.placements.filter((entry) => {
    if (entry.region !== "main" || !entry.value.resource || !input.isResourceViewer(entry.identity)) return false;
    const owner = auxiliary.get(input.resourceKey(entry.value.resource));
    return owner !== undefined && owner !== placementIdentityKey(entry.identity);
  });
  if (!retired.length) return state;
  const keys = new Set(retired.map((entry) => placementIdentityKey(entry.identity)));
  const placements = state.placements.filter((entry) => !keys.has(placementIdentityKey(entry.identity)));
  let pageStates = state.pageStates;
  for (const entry of retired)
    if (entry.identity.kind === "page")
      pageStates = editPagePlacementStates(pageStates, entry.identity, { kind: "close" });
  return {
    ...state,
    pageStates,
    placements,
    reconciliation: reconcileOwnedPlacements({
      current: previous.placements,
      desired: placements,
      destinations: state.reconciliation.destinations,
      activate: state.reconciliation.activate
        .filter((entry) => !keys.has(placementIdentityKey(entry.identity)))
        .map((entry) => entry.identity),
      valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    }),
  };
};
