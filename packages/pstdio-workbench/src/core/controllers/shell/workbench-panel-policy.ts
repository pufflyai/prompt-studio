import type { WorkbenchLayout, WorkbenchRegion } from "../../registries/layout/layout-types";
import { clampPanelSizes } from "../../registries/layout/panel-size-policy";
import { applyModePanelPolicy } from "../../registries/modes/mode-layout";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getWorkbenchPanelLayout } from "../page-runtime/workbench-layout-context";
import { resolvePanelPolicy } from "./panel-policy";
import { restorePanelDestinations } from "./restore-panel-destinations";

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

export const resolveWorkbenchPanelLayout = (core: WorkbenchCore, layout: WorkbenchLayout) => {
  const modeId = core.modes.getActiveModeId();
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  const next = applyModePanelPolicy(restorePanelDestinations(core, layout), mode, (region) =>
    core.layout.getRegionSettings(region, modeId),
  );
  return clampPanelSizes(next, core.layout.getRegionSize);
};

export const restorePanelPolicy = (core: WorkbenchCore | undefined, layout: WorkbenchLayout) =>
  !core || core.modes.isTransitioning()
    ? layout
    : clampPanelSizes(
        applyModePanelPolicy(layout, core.modes.getMode(core.modes.getActiveModeId() ?? ""), (region) =>
          core.layout.getRegionSettings(region),
        ),
        core.layout.getRegionSize,
      );

export const createWorkbenchLayoutPolicy = (resolve: () => WorkbenchCore | undefined) => ({
  normalizeLayout: (layout: WorkbenchLayout) => restorePanelPolicy(resolve(), layout),
  normalizeRestoredLayout: (layout: WorkbenchLayout) => {
    const core = resolve();
    return !core || core.modes.isTransitioning() ? layout : resolveWorkbenchPanelLayout(core, layout);
  },
});
