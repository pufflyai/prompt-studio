import type { WorkbenchLayout, WorkbenchRegion } from "../../registries/layout/layout-types";
import { clampPanelSizes } from "../../registries/layout/panel-size-policy";
import { applyModePanelPolicy } from "../../registries/modes/mode-layout";
import { isSingleViewPage } from "../../registries/pages/page-main";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getWorkbenchPanelLayout } from "../page-runtime/workbench-layout-context";
import { resolvePanelPolicy } from "./panel-policy";

export const workbenchPanelPolicy = (
  core: WorkbenchCore,
  region: WorkbenchRegion,
  modeId = core.modes.getActiveModeId(),
  proposed = core.pages.store.getState(),
) => {
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  const state = proposed;
  const page = state.activePageId ? core.pages.getPage(state.activePageId) : undefined;
  const policy = resolvePanelPolicy({
    region,
    mode,
    settings: core.layout.getRegionSettings(region, modeId),
    pageShowHeader:
      page && page.modeId === modeId
        ? page.regionSettings?.[region as "main" | "side" | "secondary"]?.showHeader
        : undefined,
    state: getWorkbenchPanelLayout(core, modeId, proposed).regions[region],
    legacyFloatable: core.sidePanel.canFloat(),
  });
  const acceptsTabs = policy.acceptsTabs && !(region === "main" && page?.modeId === modeId && isSingleViewPage(page));
  return {
    ...policy,
    acceptsTabs,
    showHeader:
      region === "main" && page?.modeId === modeId ? policy.provided && !isSingleViewPage(page) : policy.showHeader,
  };
};

export const restorePanelPolicy = (core: WorkbenchCore | undefined, layout: WorkbenchLayout) => {
  if (!core || core.modes.isTransitioning()) return layout;
  const modeId = core.modes.getActiveModeId();
  const mode = modeId ? core.modes.getMode(modeId) : undefined;
  const next = applyModePanelPolicy(layout, mode, (region) => core.layout.getRegionSettings(region, modeId));
  return clampPanelSizes(next, core.layout.getRegionSize);
};
