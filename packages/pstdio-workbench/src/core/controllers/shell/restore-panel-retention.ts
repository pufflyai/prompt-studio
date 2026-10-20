import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { updateResourcePlacementInstance } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import type { WorkbenchCore } from "../../workbench-core-types";

// The surrounding restoration publishes the rendered layout. Apply the same
// retention to its owner without starting another reconciliation in the middle.
export const retainRestoredPanel = (core: WorkbenchCore, tab: WorkbenchWidgetPlacement) => {
  const identity = tab.placementIdentity;
  if (tab.tabRetention !== "preview" || !identity || identity.kind === "page") return;
  const registry = identity.kind === "mode" ? core.modePlacements : core.shellPlacements;
  const declaration =
    identity.kind === "mode"
      ? core.modePlacements.listPlacements(identity.modeId).find((entry) => entry.id === identity.placementId)
      : core.shellPlacements.getPlacement(identity.placementId);
  if (!declaration) return;
  const owner = getOwnedPlacementPreparation(registry);
  const current = owner.getState();
  const state = {
    staticOverrides: new Map(current.staticOverrides),
    resourceInstances: new Map(current.resourceInstances),
  };
  updateResourcePlacementInstance({
    label: "Restored panel",
    id: identity.placementId,
    item: declaration.item,
    state,
    instanceKey: identity.instanceKey,
    open: "pin",
  });
  owner.apply(state);
};
