import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey, reconcileOwnedPlacements } from "../../registries/layout/placement-reconciliation";
import { PAGE_MAIN_SLOT_ID } from "../../registries/pages/page-main";
import { editPagePlacementStates, type PagePlacementEdit } from "../../registries/pages/page-placement-state";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { pageResourceContextKey } from "../../registries/pages/page-resource-context";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";

export const isDetachedPagePlacement = (core: WorkbenchCore, placement: WorkbenchWidgetPlacement) => {
  const identity = placement.placementIdentity;
  if (identity?.kind !== "page") return false;
  const state = core.pages.store.getState();
  const routedPrimary = identity.slotId === PAGE_MAIN_SLOT_ID && Boolean(state.pages[identity.pageId]?.resource);
  return (
    (!routedPrimary && !core.layout.getLayout().regions.main.widgets.includes(placement)) ||
    identity.pageId !== state.activePageId ||
    (Boolean(state.pages[identity.pageId]?.resource) &&
      pageResourceContextKey(state.pages[identity.pageId], placement.resource) !==
        pageResourceContextKey(state.pages[identity.pageId], state.location?.resource))
  );
};

// Auxiliary tabs share the mode's lifetime. Editing one must not navigate to
// the page that originally created it, even when that page is still active.
export const editSharedPagePlacement = (
  core: WorkbenchCore,
  placement: WorkbenchWidgetPlacement,
  identity: Extract<PlacementIdentity, { kind: "page" }>,
  action: PagePlacementEdit,
) => {
  const state = core.pages.store.getState();
  const key = placementIdentityKey(identity);
  const pageStates = editPagePlacementStates(state.pageStates, identity, action);
  const placements = state.placements.flatMap((entry) => {
    if (placementIdentityKey(entry.identity) !== key) return [entry];
    if (action.kind === "close") return [];
    return [
      {
        ...entry,
        value: {
          ...placement,
          pinned: action.open === "pin",
          tabRetention: action.open === "pin" ? ("persistent" as const) : ("preview" as const),
        },
      },
    ];
  });
  batchWorkbenchChanges(() => {
    if (action.kind === "close") core.layout.removeWidgetPlacement(placement.widgetId);
    else
      core.layout.updateWidgetPlacement(placement.widgetId, {
        pinned: action.open === "pin",
        tabRetention: action.open === "pin" ? "persistent" : "preview",
      });
    getWorkbenchPageRegistryInternals(core.pages).publish(
      {
        ...state,
        pageStates,
        placements,
        reconciliation: reconcileOwnedPlacements({
          current: state.placements,
          desired: placements,
          valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
        }),
      },
      "editSharedPagePlacement",
    );
  });
};
