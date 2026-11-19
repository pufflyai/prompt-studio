import type { PageRef } from "@pstdio/sdk/extensions";
import type { TreeListNode } from "@pstdio/ui";
import type { NavigationTarget, NavigationTargetPanel, WorkbenchCore, WorkbenchPanelRegion } from "../../../core";
import { openDroppedPage, panelResourcePageTarget } from "../../../core/controllers/composition/panel-page-drop";
import { resourcePageTab } from "../../../core/controllers/navigation/resource-page-tab";
import { getPageLocationPreparation } from "../../../core/controllers/page-location/page-location-preparation";
import { replacedPageSlot } from "../../../core/registries/modes/placement-replacement";
import { pageSlots } from "../../../core/registries/pages/page-main";
import { reportUserActionError, runUserAction } from "../../../core/shared/run-user-action";

const findPage = (workbench: WorkbenchCore, ref: PageRef) =>
  workbench.pages.listPages().find((page) => page.ref.id === ref.id && page.ref.extensionId === ref.extensionId);

const panelItem = (workbench: WorkbenchCore, panel: NavigationTargetPanel["panel"]) => {
  if (panel.kind === "shell-placement") return workbench.shellPlacements.getPlacement(panel.id)?.item;
  if (panel.kind === "placement") return workbench.modePlacements.getPlacement(panel)?.item;
  const page = findPage(workbench, panel.page);
  return (
    replacedPageSlot(workbench.modePlacements, panel)?.item ??
    (page && pageSlots(page).find((slot) => slot.id === panel.id)?.item)
  );
};
const panelAcceptsPin = (workbench: WorkbenchCore, panel: NavigationTargetPanel["panel"]) => {
  const item = panelItem(workbench, panel);
  return item?.kind === "binding" && item.binding.cardinality === "many";
};
type PageState = ReturnType<WorkbenchCore["pages"]["store"]["getState"]>;
const nextTabContainer = (workbench: WorkbenchCore, target: NavigationTarget, state: PageState) => {
  if (target.kind !== "page" || resourcePageTab(workbench, target, state)) return state;
  const { pageId, location } = getPageLocationPreparation(workbench.pageLocations).resolve(target);
  return { ...state, activePageId: pageId, activeModeId: state.pages[pageId]?.modeId, location };
};

const treeTabItemTarget = (
  workbench: WorkbenchCore,
  target: Exclude<NavigationTarget, { kind: "compound" }>,
  region: WorkbenchPanelRegion,
  state: PageState | null = workbench.pages.store.getState(),
) => {
  if (target.kind === "panel") {
    const { open: _open, ...panel } = target;
    return {
      ...panel,
      region,
      ...(target.resource && panelAcceptsPin(workbench, target.panel) ? { open: "pin" as const } : {}),
    };
  }
  if (target.kind !== "page") return;
  const page = findPage(workbench, target.page);
  if (region === "main") {
    const { open: _open, ...destination } = target;
    let acceptsPin = Boolean(state && resourcePageTab(workbench, target, state));
    if (page?.main.kind === "view") acceptsPin ||= page.main.cardinality === "many";
    if (page?.main.kind === "panels" && typeof page.main.landing === "object")
      acceptsPin ||= panelAcceptsPin(workbench, page.main.landing);
    return { ...destination, ...(target.resource && acceptsPin ? { open: "pin" as const } : {}) };
  }
  if (!page?.panelView) return;
  return {
    kind: "panel" as const,
    panel: page.panelView,
    resource: target.resource,
    region,
    ...(target.resource && panelAcceptsPin(workbench, page.panelView) ? { open: "pin" as const } : {}),
  };
};

export const treeTabTarget = (workbench: WorkbenchCore, target: NavigationTarget, region: WorkbenchPanelRegion) => {
  if (target.kind !== "compound") return treeTabItemTarget(workbench, target, region);
  if (region !== "main") return;
  let state = workbench.pages.store.getState();
  const targets = [];
  for (const item of target.targets) {
    const next = treeTabItemTarget(workbench, item, region, state);
    if (!next) return;
    targets.push(next);
    state = nextTabContainer(workbench, item, state);
  }
  return { kind: "compound" as const, targets };
};

export const treePageTarget = (workbench: WorkbenchCore, intent: NavigationTarget) => {
  if (intent.kind === "compound") {
    const targets = intent.targets.map((item) => treeTabItemTarget(workbench, item, "main", null));
    if (targets.some((item) => !item)) return;
    return { kind: "compound" as const, targets: targets.filter((item) => item !== undefined) };
  }
  if (intent.kind === "panel") return panelResourcePageTarget(workbench, intent.panel, intent.resource);
  if (intent.kind !== "page") return;
  const { open: _open, ...page } = intent;
  return page;
};
const openTreePage = (workbench: WorkbenchCore, node: TreeListNode) => {
  if (node.navigationIntent?.id !== "target") return false;
  const target = treePageTarget(workbench, node.navigationIntent.payload as NavigationTarget);
  if (!target) return false;
  void openDroppedPage(workbench, target).catch((error) => reportUserActionError(workbench, "Open page", error));
  return true;
};

export const createTreeTabDropHandler =
  (workbench: WorkbenchCore) => (node: TreeListNode, point: { x: number; y: number }) => {
    const element = document.elementFromPoint(point.x, point.y);
    if (element?.closest("[inert]")) return false;
    const header = element?.closest("[data-workbench-panel-header]");
    if (!header && element?.closest('[data-workbench-panel="main"]')) {
      return openTreePage(workbench, node);
    }
    const region = header?.getAttribute("data-workbench-panel-header");
    if (region !== "main" && region !== "side" && region !== "secondary") return false;
    if (node.navigationIntent?.id !== "target") return true;
    void runUserAction(workbench, "Open tab", () => {
      const target = treeTabTarget(workbench, node.navigationIntent!.payload as NavigationTarget, region);
      if (target) return workbench.navigation.openTarget(target);
      workbench.notifications.show({
        level: "info",
        title: "This page opens in Main",
        message: "Select the navigation entry to open it.",
      });
    });
    return true;
  };
