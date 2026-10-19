import type { WorkbenchLayout, WorkbenchRegion } from "../../registries/layout/layout-types";
import { clampPanelSizes } from "../../registries/layout/panel-size-policy";
import { applyModePanelPolicy } from "../../registries/modes/mode-layout";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getWorkbenchPanelLayout } from "../page-runtime/workbench-layout-context";
import { resolvePanelPolicy } from "./panel-policy";

export const workbenchPanelPolicy = (
  core: WorkbenchCore,
  region: WorkbenchRegion,
  modeId = core.modes.getActiveModeId(),
) => {
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  return resolvePanelPolicy({
    region,
    mode,
    settings: core.layout.getRegionSettings(region, modeId),
    state: getWorkbenchPanelLayout(core, modeId).regions[region],
    legacyFloatable: core.sidePanel.canFloat(),
  });
};

export const restorePanelPolicy = (core: WorkbenchCore | undefined, layout: WorkbenchLayout) => {
  if (!core || core.modes.isTransitioning()) return layout;
  const modeId = core.modes.getActiveModeId();
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  const next = applyModePanelPolicy(layout, mode, (region) => core.layout.getRegionSettings(region, modeId));
  return clampPanelSizes(next, core.layout.getRegionSize);
};
