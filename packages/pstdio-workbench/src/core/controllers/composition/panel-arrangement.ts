import { contributionRefId } from "@pstdio/sdk/extensions";
import {
  activateInLayout,
  findPlacementByWidgetId,
  removeLocationSubPanelSelection,
  selectRegionActiveWidget,
} from "../../registries/layout/layout-operations";
import { insertAtPosition } from "../../registries/layout/layout-tab-lifecycle";
import type { WorkbenchPanelRegion, WorkbenchTabPosition } from "../../registries/layout/layout-types";
import { workbenchPanelRegions } from "../../registries/layout/layout-types";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { revealPanelRegion } from "../../workbench-core-navigation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { saveOpenOwnerLayouts } from "../page-runtime/open-owner-layouts";
import { reconcileMainAfterMove } from "./main-document-fallback";
import { panelDestinations } from "./panel-destinations";
import { transferPanelOwner } from "./panel-owner-transfer";

export const createPanelArrangement = (resolve: () => WorkbenchCore) => ({
  getPanelDestinations(instanceId: string) {
    const core = resolve();
    const found = findPlacementByWidgetId(core.layout.getLayout(), instanceId);
    return found ? panelDestinations(core, found.placement.contributionId) : [];
  },
  movePanel(instanceId: string, destination: WorkbenchPanelRegion, position: WorkbenchTabPosition = "end") {
    const core = resolve();
    const layout = core.layout.getLayout();
    const found = findPlacementByWidgetId(layout, instanceId);
    if (!found) throw new Error(`Panel instance not found: ${instanceId}`);
    if (
      !workbenchPanelRegions.some((region) => region === found.regionId) ||
      !panelDestinations(core, found.placement.contributionId).includes(destination)
    )
      throw new Error(`Panel cannot move to ${destination}: ${instanceId}`);
    const source = layout.regions[found.regionId];
    const remaining = source.widgets.filter((t) => t.widgetId !== instanceId);
    const adjacent =
      found.regionId === "main" && found.placement.role === "location"
        ? [...source.widgets.slice(found.index + 1), ...source.widgets.slice(0, found.index).reverse()].find(
            (tab) => tab.role === "location",
          )
        : (remaining[found.index] ?? remaining[found.index - 1]);
    const pageState = core.pages.store.getState();
    const page = pageState.activePageId ? pageState.pages[pageState.activePageId] : undefined;
    const emptyView = page?.main.kind === "panels" ? contributionRefId(page.main.empty) : undefined;
    const target = {
      ...layout.regions[destination],
      widgets: layout.regions[destination].widgets.filter(
        (tab) => destination !== "main" || !emptyView || tab.viewId !== emptyView,
      ),
    };
    const placement = transferPanelOwner(core, found.placement, destination);
    const next = {
      ...removeLocationSubPanelSelection(layout, instanceId),
      regions: {
        ...layout.regions,
        [found.regionId]: {
          ...source,
          widgets: remaining,
          activeWidgetId: source.activeWidgetId === instanceId ? adjacent?.widgetId : source.activeWidgetId,
        },
        [destination]: {
          ...target,
          visible: true,
          widgets: insertAtPosition(destination === found.regionId ? remaining : target.widgets, placement, position),
        },
      },
    };
    batchWorkbenchChanges(() => {
      // Moving selects the instance directly; navigation owns auxiliary-selection restoration.
      const selected =
        found.placement.role === "location"
          ? (selectRegionActiveWidget(next, destination, instanceId) ?? next)
          : activateInLayout(next, destination, placement);
      core.layout.restoreLayout({
        ...selected,
        activeWidgetId: instanceId,
        activeResourceKey: found.placement.resourceKey,
        activeLocationWidgetId:
          found.regionId === "main" && destination !== "main" && layout.activeLocationWidgetId === instanceId
            ? next.regions.main.activeWidgetId
            : layout.activeLocationWidgetId,
      });
      saveOpenOwnerLayouts(core);
      if (found.regionId === "main" && destination !== "main") reconcileMainAfterMove(core);
      const final = core.layout.getLayout();
      core.layout.restoreLayout({
        ...final,
        regions: { ...final.regions, [destination]: { ...final.regions[destination], activeWidgetId: instanceId } },
        activeWidgetId: instanceId,
        activeResourceKey: found.placement.resourceKey,
        activeLocationWidgetId:
          found.regionId === "main" && destination !== "main"
            ? final.regions.main.activeWidgetId
            : final.activeLocationWidgetId,
      });
      core.layout.reconcilePanelMenus();
      revealPanelRegion(core, destination);
      core.focus.setActiveRegion(destination);
      core.focus.requestPanelFocus(instanceId);
    });
  },
});
