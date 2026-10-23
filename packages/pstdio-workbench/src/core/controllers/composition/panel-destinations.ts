import { type WorkbenchRegion, workbenchPanelRegions } from "../../registries/layout/layout-types";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import type { WorkbenchModeContribution } from "../../registries/modes/mode-registry";
import type { WorkbenchCore } from "../../workbench-core-types";

export const allowedPanelDestinations = (mode?: WorkbenchModeContribution) =>
  workbenchPanelRegions.filter(
    (region) => isWorkbenchModePanelAvailable(mode, region) && mode?.regionSettings?.[region]?.acceptsTabs !== false,
  );

export const allowedPanelAddRegions = (mode?: WorkbenchModeContribution, addableIn?: readonly WorkbenchRegion[]) =>
  allowedPanelDestinations(mode).filter((region) => !addableIn || addableIn.includes(region));

export const panelDestinations = (core: WorkbenchCore, contributionId: string) => {
  const widget = core.layout.getWidget(contributionId);
  if (!widget || !workbenchPanelRegions.some((region) => region === widget.region)) return [];
  const modeId = core.modes.getActiveModeId();
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  return allowedPanelDestinations(mode).filter((region) => {
    const policy = core.shell.getPanelPolicy(region);
    return policy.acceptsTabs && (policy.open || policy.canOpen);
  });
};
