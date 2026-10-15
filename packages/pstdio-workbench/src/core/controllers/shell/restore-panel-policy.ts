import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { defaultPageLayout, enforceFixedGeometry } from "../../registries/layout/panel-geometry";
import { clampPanelSizes } from "../../registries/layout/panel-size-policy";
import { applyModePanelAvailability, panelsForMode } from "../../registries/modes/mode-layout";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchCore } from "../../workbench-core-types";
import { restoreTabRegions } from "./restore-tab-regions";

export const restorePanelPolicy = (core: WorkbenchCore | undefined, layout: WorkbenchLayout) => {
  const modeId = core?.modes.getActiveModeId();
  const mode = modeId ? core?.modes.getMode(modeId) : undefined;
  if (!core) return layout;
  // Mode and page transitions validate their destination before publication.
  if (core.modes.isTransitioning()) return layout;
  const placed = restoreTabRegions(core, layout);
  const next = mode ? applyModePanelAvailability(placed, panelsForMode(mode)) : placed;
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
  const regions = { ...pageGeometry.regions };
  for (const id of ["main", "side", "secondary", "aside", "bottom"] as const) {
    const policy = core.shell.getPanelPolicy(id);
    const state = regions[id];
    regions[id] = {
      ...state,
      visibility:
        (state.visibility === "closed" && !policy.canClose) || (state.visibility === "open" && !policy.canOpen)
          ? undefined
          : state.visibility,
      ...(id === "side" && !policy.floatable ? { presentation: "attached" as const } : {}),
    };
  }
  return clampPanelSizes({ ...pageGeometry, regions }, (region) =>
    region === "bottom" || region === "aside" ? page?.regionSettings?.[region] : core.layout.getRegionSettings(region),
  );
};
