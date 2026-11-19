import type { NavigationTargetPage, ViewLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { isSingleViewPage } from "../../registries/pages/page-main";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import { portablePagePanel } from "../page-runtime/portable-page-panel";
import { workbenchPanelPolicy } from "../shell/workbench-panel-policy";

export const resourcePageTab = (
  core: WorkbenchCore,
  target: NavigationTargetPage,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const current = state.pages[state.activePageId ?? ""];
  if (
    !target.resource ||
    target.intent === "restore" ||
    !current ||
    current.main.kind === "group" ||
    isSingleViewPage(current) ||
    !workbenchPanelPolicy(core, "main", state.activeModeId, state).acceptsTabs
  )
    return;
  const { location, pageId } = getPageLocationPreparation(core.pageLocations).resolve(target);
  const page = state.pages[pageId];
  if (!page?.resource || pageId === state.activePageId || page.modeId !== state.activeModeId) return;
  if (page.slots.some((slot) => slot.region === "main")) return;
  let panel = page.main.kind === "view" ? portablePagePanel(page, core.modePlacements) : undefined;
  if (page.main.kind === "panels" && typeof page.main.landing === "object") {
    const landing = core.modePlacements.getPlacement(page.main.landing);
    if (
      landing?.modeId === page.modeId &&
      landing.region === "main" &&
      landing.item.kind === "binding" &&
      landing.item.binding.cardinality === "many" &&
      location.resource &&
      resourceMatchesConstraint(landing.item.binding, location.resource)
    )
      panel = page.main.landing;
  }
  if (!panel) return;
  const context: ViewLocation = {
    section: location.section,
    position: location.position,
    pageContext: { page: location.page, parent: location.parent, params: location.params },
  };
  return {
    target: {
      kind: "panel",
      panel,
      region: "main",
      resource: location.resource,
      open: target.open,
    } satisfies NavigationTargetPanel,
    location: context,
  };
};

export const resolveResourceTabTarget = (
  core: WorkbenchCore,
  target: NavigationTargetPage | NavigationTargetPanel,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  options: { resourceTabs?: boolean; location?: ViewLocation },
) => {
  const tab = options.resourceTabs && target.kind === "page" ? resourcePageTab(core, target, state) : undefined;
  return tab ?? { target, location: options.location };
};
