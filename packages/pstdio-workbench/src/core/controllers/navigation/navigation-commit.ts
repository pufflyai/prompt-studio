import type { WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { revealPanelRegion } from "../../workbench-core-navigation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";

export const activateNavigationPlacement = (
  core: WorkbenchCore,
  identity: PlacementIdentity,
  destination?: WorkbenchPanelRegion,
) => {
  const key = placementIdentityKey(identity);
  for (const region of Object.values(core.layout.getLayout().regions)) {
    const tab = region.widgets.find(
      (tab) => tab.placementIdentity && placementIdentityKey(tab.placementIdentity) === key,
    );
    if (tab) {
      const changesOwner =
        destination && ["main", "aside", "bottom"].includes(destination) !== (identity.kind === "page");
      if (destination && (destination !== region.id || changesOwner)) {
        core.movePanel(tab.widgetId, destination);
        return;
      }
      core.fullscreen.beforeReveal(region.id);
      revealPanelRegion(core, region.id);
      core.layout.activatePanel(tab.widgetId);
      return;
    }
  }
};

export const commitPreparedNavigation = (input: {
  core: WorkbenchCore;
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
  applyOwners(): void;
  publishOwners(): void;
  activateTargets(): void;
}) =>
  batchWorkbenchChanges(() => {
    const { core, state } = input;
    const pages = getWorkbenchPageRegistryInternals(core.pages);
    const locations = getPageLocationPreparation<WorkbenchWidgetPlacement>(core.pageLocations);
    const withoutLocation = () => {
      input.applyOwners();
      return pages.publish(state, "navigateCompoundTarget");
    };
    const result = state.location ? locations.commit(state, input.applyOwners) : withoutLocation();
    input.publishOwners();
    // Owner publication reconciles saved selection; the explicit open chooses the final selection.
    input.activateTargets();
    const layout = core.layout.getLayout();
    const region = Object.values(layout.regions).find((region) =>
      region.widgets.some((tab) => tab.widgetId === layout.activeWidgetId),
    );
    if (region && ["main", "aside", "bottom", "side", "secondary"].includes(region.id))
      core.focus.setActiveRegion(region.id as "main" | "aside" | "bottom" | "side" | "secondary");
    if (layout.activeWidgetId) core.focus.requestPanelFocus(layout.activeWidgetId);
    return result;
  });

import type { PlacementIdentity } from "@pstdio/sdk/extensions";
