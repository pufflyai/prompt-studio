import type { WorkbenchLayout, WorkbenchRegion } from "../../registries/layout/layout-types";
import { clampPanelSizes } from "../../registries/layout/panel-size-policy";
import { applyModePanelAvailability, panelsForMode } from "../../registries/modes/mode-layout";
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
  const next = mode ? applyModePanelAvailability(layout, panelsForMode(mode)) : layout;
  const regions = { ...next.regions };
  let changed = false;
  for (const region of Object.values(regions)) {
    if (
      (region.id === "side" || region.id === "secondary") &&
      core.layout.getRegionSettings(region.id)?.canClose === false &&
      !region.visible &&
      core.layout.getLayout().regions[region.id].visible
    ) {
      regions[region.id] = { ...region, visible: true };
      changed = true;
    }
  }
  return clampPanelSizes(changed ? { ...next, regions } : next, core.layout.getRegionSize);
};
