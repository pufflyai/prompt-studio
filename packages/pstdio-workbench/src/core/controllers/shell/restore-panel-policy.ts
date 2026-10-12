import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { applyModePanelAvailability, panelsForMode } from "../../registries/modes/mode-layout";
import type { WorkbenchCore } from "../../workbench-core-types";

export const restorePanelPolicy = (core: WorkbenchCore | undefined, layout: WorkbenchLayout) => {
  const modeId = core?.modes.getActiveModeId();
  const mode = modeId ? core?.modes.getMode(modeId) : undefined;
  // Mode transitions validate the destination before publication themselves.
  if (!core || !mode || core.modes.isTransitioning()) return layout;
  let next = applyModePanelAvailability(layout, panelsForMode(mode));
  for (const region of ["side", "secondary", "bottom"] as const) {
    const state = next.regions[region];
    const bounds = core.layout.getRegionSettings(region)?.size;
    if (state.size === undefined || !bounds) continue;
    const size = Math.min(bounds.maxPx ?? Infinity, Math.max(bounds.minPx ?? 0, state.size));
    if (state.size !== size) next = { ...next, regions: { ...next.regions, [region]: { ...state, size } } };
  }
  return next;
};
