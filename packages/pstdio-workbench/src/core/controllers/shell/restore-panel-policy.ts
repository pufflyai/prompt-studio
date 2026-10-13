import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { clampPanelSizes } from "../../registries/layout/panel-size-policy";
import { applyModePanelAvailability, panelsForMode } from "../../registries/modes/mode-layout";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchCore } from "../../workbench-core-types";

export const restorePanelPolicy = (core: WorkbenchCore | undefined, layout: WorkbenchLayout) => {
  const modeId = core?.modes.getActiveModeId();
  const mode = modeId ? core?.modes.getMode(modeId) : undefined;
  if (!core) return layout;
  // Mode and page transitions validate their destination before publication.
  if (core.modes.isTransitioning()) return layout;
  const next = mode ? applyModePanelAvailability(layout, panelsForMode(mode)) : layout;
  const owner = getWorkbenchPageRegistryInternals(core.pages).getPublishingState();
  const page = owner.activePageId ? owner.pages[owner.activePageId] : undefined;
  return clampPanelSizes(next, (region) =>
    region === "bottom" ? page?.regionSettings?.bottom : core.layout.getRegionSettings(region),
  );
};
