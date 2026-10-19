import type { WorkbenchLayout, WorkbenchRegion } from "../../registries/layout/layout-types";
import { applyModePanelAvailability, panelsForMode } from "../../registries/modes/mode-layout";
import type { WorkbenchCore } from "../../workbench-core-types";
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
    settings:
      modeId === core.modes.getActiveModeId() ? core.layout.getRegionSettings(region) : mode?.regionSettings?.[region],
    state: core.layout.getLayout().regions[region],
    legacyFloatable: core.sidePanel.canFloat(),
  });
};

export const restorePanelPolicy = (core: WorkbenchCore | undefined, layout: WorkbenchLayout) => {
  if (!core) return layout;
  const modeId = core.modes.getActiveModeId();
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  const next = mode && !core.modes.isTransitioning() ? applyModePanelAvailability(layout, panelsForMode(mode)) : layout;
  const regions = { ...next.regions };
  let changed = false;
  for (const region of Object.values(regions)) {
    if (
      !core.modes.isTransitioning() &&
      (region.id === "side" || region.id === "secondary") &&
      mode?.regionSettings?.[region.id]?.canClose === false &&
      !region.visible &&
      core.layout.getLayout().regions[region.id].visible
    ) {
      regions[region.id] = { ...region, visible: true };
      changed = true;
    }
    const size = core.layout.getRegionSize(region.id);
    if (region.size === undefined || !size) continue;
    const clamped = Math.min(size.maxPx ?? Infinity, Math.max(size.minPx ?? 0, region.size));
    if (clamped !== region.size) {
      regions[region.id] = { ...regions[region.id], size: clamped };
      changed = true;
    }
  }
  return changed ? { ...next, regions } : next;
};
