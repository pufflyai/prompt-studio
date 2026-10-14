import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { defaultPageLayout, enforceFixedGeometry } from "../../registries/layout/panel-geometry";
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
  const modeGeometry = enforceFixedGeometry(
    next,
    { ...next, modeLayout: mode?.layout },
    ["side", "sidenav", "main", "secondary"],
    (panel) => core.shell.getPanelPolicy(panel).movable,
  );
  const pageGeometry = enforceFixedGeometry(
    modeGeometry,
    {
      ...modeGeometry,
      pageLayout: defaultPageLayout(page?.regionSettings?.aside?.edge, page?.regionSettings?.bottom?.edge),
    },
    ["aside", "bottom"],
    (panel) => core.shell.getPanelPolicy(panel).movable,
  );
  return clampPanelSizes(pageGeometry, (region) =>
    region === "bottom" || region === "aside" ? page?.regionSettings?.[region] : core.layout.getRegionSettings(region),
  );
};
