import type { NavigationTargetPage, ResourceRef, ViewLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { isSingleViewPage } from "../../registries/pages/page-main";
import type { WorkbenchPageContribution, WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import { portablePagePanel, portablePageSlotPanel } from "../page-runtime/portable-page-panel";
import { workbenchPanelPolicy } from "../shell/workbench-panel-policy";

const pageAcceptsRetention = (core: WorkbenchCore, page: WorkbenchPageContribution, resource?: ResourceRef) => {
  if (page.main.kind === "view") return page.main.cardinality === "many";
  if (page.main.kind !== "panels" || typeof page.main.landing !== "object") return false;
  const landing = core.modePlacements.getPlacement(page.main.landing);
  return (
    landing?.item.kind === "binding" &&
    landing.item.binding.cardinality === "many" &&
    Boolean(resource && resourceMatchesConstraint(landing.item.binding, resource))
  );
};

const resourcePanel = (
  core: WorkbenchCore,
  page: WorkbenchPageContribution,
  resource: ResourceRef | undefined,
  region: "main" | "side" | "secondary",
) => {
  if (region === "main" && page.slots.some((slot) => slot.region === "main")) return;
  if (page.main.kind === "view") return portablePagePanel(page, core.modePlacements);
  if (page.main.kind !== "panels") return;
  const ref = page.main.landing;
  if (typeof ref === "string" && region !== "main") {
    const landing = page.slots.find((slot) => slot.id === ref && slot.region === "main");
    const portable = landing && portablePageSlotPanel(page, landing.id);
    if (portable && core.modePlacements.getPlacement(portable)) return portable;
  }
  if (typeof ref !== "object") return;
  const landing = core.modePlacements.getPlacement(ref);
  if (
    landing?.modeId === page.modeId &&
    landing.region === "main" &&
    landing.item.kind === "binding" &&
    landing.item.binding.cardinality === "many" &&
    resource &&
    resourceMatchesConstraint(landing.item.binding, resource)
  )
    return ref;
};

export const resourcePageTab = (
  core: WorkbenchCore,
  target: NavigationTargetPage,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const region = target.region ?? "main";
  const current = state.pages[state.activePageId ?? ""];
  if (
    !target.resource ||
    target.intent === "restore" ||
    (region === "main" && (current?.main.kind === "group" || (current && isSingleViewPage(current)))) ||
    !workbenchPanelPolicy(core, region, state.activeModeId, state).acceptsTabs
  )
    return;
  const { location, pageId } = getPageLocationPreparation(core.pageLocations).resolve(target);
  const page = state.pages[pageId];
  if (!page?.resource || (region === "main" && pageId === state.activePageId) || page.modeId !== state.activeModeId)
    return;
  const panel = resourcePanel(core, page, location.resource, region);
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
      region,
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
  const panelPage = target.kind === "page" && target.region && target.region !== "main";
  const tab =
    target.kind === "page" && (options.resourceTabs || panelPage) ? resourcePageTab(core, target, state) : undefined;
  if (panelPage && !tab) {
    const { pageId } = getPageLocationPreparation(core.pageLocations).resolve(target);
    if (state.pages[pageId]?.modeId !== state.activeModeId) {
      const { region: _region, open, ...page } = target;
      if (pageAcceptsRetention(core, state.pages[pageId]!, target.resource))
        return { target: { ...page, open }, location: options.location };
      return { target: page, location: options.location };
    }
    throw new Error(`Resource page cannot open in ${target.region}`);
  }
  return tab ?? { target, location: options.location };
};
