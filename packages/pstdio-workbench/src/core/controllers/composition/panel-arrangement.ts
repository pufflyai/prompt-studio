import {
  activateInLayout,
  findPlacementByWidgetId,
  removeLocationSubPanelSelection,
} from "../../registries/layout/layout-operations";
import { insertAtPosition } from "../../registries/layout/layout-tab-lifecycle";
import type { WorkbenchPanelRegion, WorkbenchTabPosition } from "../../registries/layout/layout-types";
import { workbenchPanelRegions } from "../../registries/layout/layout-types";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import { modePlacementContributionId } from "../../registries/views/view-placement";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { revealPanelRegion } from "../../workbench-core-navigation";
import type { WorkbenchCore } from "../../workbench-core-types";

export const panelDestinations = (core: WorkbenchCore, contributionId: string) => {
  const widget = core.layout.getWidget(contributionId);
  if (!widget || !workbenchPanelRegions.some((region) => region === widget.region)) return [];
  const mode = core.modes.getActiveModeId();
  const activeMode = mode ? core.modes.getMode(mode) : undefined;
  const declaration = core.modePlacements
    .listPlacements(mode)
    .find((p) => modePlacementContributionId(p.id) === contributionId);
  const legacyPanel = activeMode
    ?.listAddablePanels?.({ layout: core.layout.getLayout(), resource: core.getPrimaryResource() })
    .find((p) => p.panelId === contributionId);
  return workbenchPanelRegions.filter(
    (region) =>
      isWorkbenchModePanelAvailable(activeMode, region) &&
      (!declaration?.movableTo || declaration.movableTo.includes(region)) &&
      (!legacyPanel?.allowedRegions || legacyPanel.allowedRegions.includes(region)),
  );
};

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
    const target = layout.regions[destination];
    const next = {
      ...removeLocationSubPanelSelection(layout, instanceId),
      regions: {
        ...layout.regions,
        [found.regionId]: {
          ...source,
          widgets: remaining,
          activeWidgetId:
            source.activeWidgetId === instanceId
              ? (remaining[found.index] ?? remaining[found.index - 1])?.widgetId
              : source.activeWidgetId,
        },
        [destination]: {
          ...target,
          visible: true,
          widgets: insertAtPosition(
            destination === found.regionId ? remaining : target.widgets,
            found.placement,
            position,
          ),
        },
      },
    };
    batchWorkbenchChanges(() => {
      core.layout.restoreLayout(activateInLayout(next, destination, found.placement));
      core.layout.reconcilePanelMenus();
      revealPanelRegion(core, destination);
    });
  },
});
