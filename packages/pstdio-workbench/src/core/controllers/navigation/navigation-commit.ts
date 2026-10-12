import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { revealPanelRegion } from "../../workbench-core-navigation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";

export const commitPreparedNavigation = (input: {
  core: WorkbenchCore;
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
  applyOwners(): void;
  publishOwners(): void;
  activateEditors(): void;
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
    for (const placement of state.reconciliation.activate) {
      const key = placementIdentityKey(placement.identity);
      for (const region of Object.values(core.layout.getLayout().regions)) {
        const tab = region.widgets.find(
          (tab) => tab.placementIdentity && placementIdentityKey(tab.placementIdentity) === key,
        );
        if (tab) {
          revealPanelRegion(core, region.id);
          core.layout.activatePanel(tab.widgetId);
          break;
        }
      }
    }
    input.activateEditors();
    const layout = core.layout.getLayout();
    const region = Object.values(layout.regions).find((region) =>
      region.widgets.some((tab) => tab.widgetId === layout.activeWidgetId),
    );
    if (region && ["main", "bottom", "side", "secondary"].includes(region.id))
      core.focus.setActiveRegion(region.id as "main" | "bottom" | "side" | "secondary");
    if (layout.activeWidgetId) core.focus.requestPanelFocus(layout.activeWidgetId);
    return result;
  });
