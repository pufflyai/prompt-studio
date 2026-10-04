import { type WorkbenchRegion, workbenchPanelRegions } from "../../registries/layout/layout-types";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import type { WorkbenchModeContribution } from "../../registries/modes/mode-registry";
import { modePlacementContributionId } from "../../registries/views/view-placement";
import type { WorkbenchCore } from "../../workbench-core-types";

interface PanelDestinationPolicy {
  mode?: WorkbenchModeContribution;
  movableTo?: readonly WorkbenchRegion[];
  allowedRegions?: readonly WorkbenchRegion[];
}

export const allowedPanelDestinations = (policy: PanelDestinationPolicy) =>
  workbenchPanelRegions.filter(
    (region) =>
      isWorkbenchModePanelAvailable(policy.mode, region) &&
      (!policy.movableTo || policy.movableTo.includes(region)) &&
      (!policy.allowedRegions || policy.allowedRegions.includes(region)),
  );

export const panelDestinations = (core: WorkbenchCore, contributionId: string) => {
  const widget = core.layout.getWidget(contributionId);
  if (!widget || !workbenchPanelRegions.some((region) => region === widget.region)) return [];
  const modeId = core.modes.getActiveModeId();
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  const declaration = core.modePlacements
    .listPlacements(modeId)
    .find((p) => modePlacementContributionId(p.id) === contributionId);
  const legacyPanel = mode
    ?.listAddablePanels?.({ layout: core.layout.getLayout(), resource: core.getPrimaryResource() })
    .find((p) => p.panelId === contributionId);
  return allowedPanelDestinations({
    mode,
    movableTo: declaration?.movableTo,
    allowedRegions: legacyPanel?.allowedRegions,
  });
};
