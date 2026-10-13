import { type WorkbenchRegion, workbenchPanelRegions } from "../../registries/layout/layout-types";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import type { WorkbenchModeContribution } from "../../registries/modes/mode-registry";
import { pageHasBottom } from "../../registries/pages/page-panel-menus";
import { modePlacementContributionId } from "../../registries/views/view-placement";
import type { WorkbenchCore } from "../../workbench-core-types";

interface PanelDestinationPolicy {
  mode?: WorkbenchModeContribution;
  movableTo?: readonly WorkbenchRegion[];
  allowedRegions?: readonly WorkbenchRegion[];
  pageBottom?: boolean;
}

export const allowedPanelDestinations = (policy: PanelDestinationPolicy) =>
  workbenchPanelRegions.filter(
    (region) =>
      isWorkbenchModePanelAvailable(policy.mode, region) &&
      (region !== "bottom" || policy.pageBottom === true) &&
      (!policy.movableTo || policy.movableTo.includes(region)) &&
      (!policy.allowedRegions || policy.allowedRegions.includes(region)),
  );

export const panelDestinations = (core: WorkbenchCore, contributionId: string) => {
  const widget = core.layout.getWidget(contributionId);
  if (!widget || !workbenchPanelRegions.some((region) => region === widget.region)) return [];
  const modeId = core.modes.getActiveModeId();
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  const pageState = core.pages.store.getState();
  const page = pageState.activePageId ? core.pages.getPage(pageState.activePageId) : undefined;
  const declaration = core.modePlacements
    .listPlacements(modeId)
    .find((p) => modePlacementContributionId(p.id) === contributionId);
  const legacyPanel = mode
    ?.listAddablePanels?.({ layout: core.layout.getLayout(), resource: core.getPrimaryResource() })
    .find((p) => p.panelId === contributionId);
  return allowedPanelDestinations({
    mode,
    pageBottom: pageHasBottom(page),
    movableTo: declaration?.movableTo,
    allowedRegions: legacyPanel?.allowedRegions,
  }).filter((region) => {
    const policy = core.shell.getPanelPolicy(region);
    return policy.acceptsTabs && (policy.open || policy.canOpen);
  });
};
