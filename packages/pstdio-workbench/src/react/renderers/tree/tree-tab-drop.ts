import type { PageRef } from "@pstdio/sdk/extensions";
import type { TreeListNode } from "@pstdio/ui";
import type { NavigationTarget, NavigationTargetPanel, WorkbenchCore, WorkbenchPanelRegion } from "../../../core";
import { openDroppedPage, panelResourcePageTarget } from "../../../core/controllers/composition/panel-page-drop";
import { replacedPageSlot } from "../../../core/registries/modes/placement-replacement";
import { pageSlots } from "../../../core/registries/pages/page-main";
import { reportUserActionError } from "../../../core/shared/run-user-action";

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

const treeTabItemTarget = (
  workbench: WorkbenchCore,
  target: Exclude<NavigationTarget, { kind: "compound" }>,
  region: WorkbenchPanelRegion,
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
    const acceptsPin =
      page?.main.kind === "view"
        ? page.main.cardinality === "many"
        : page?.main.kind === "panels" &&
          typeof page.main.landing === "object" &&
          panelAcceptsPin(workbench, page.main.landing);
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
  const targets = target.targets.map((item) => treeTabItemTarget(workbench, item, region));
  if (targets.some((item) => !item)) return;
  return { kind: "compound" as const, targets: targets.filter((item) => item !== undefined) };
};

export const treePageTarget = (workbench: WorkbenchCore, intent: NavigationTarget) => {
  if (intent.kind === "compound") {
    const target = treeTabTarget(workbench, intent, "main");
    return target?.kind === "compound" ? target : undefined;
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
    const target = treeTabTarget(workbench, node.navigationIntent.payload as NavigationTarget, region);
    if (target)
      void (
        target.kind === "page" || target.kind === "compound"
          ? openDroppedPage(workbench, target)
          : workbench.navigation.openTarget(target)
      ).catch((error) => reportUserActionError(workbench, "Open tab", error));
    else
      workbench.notifications.show({
        level: "info",
        title: "This page opens in Main",
        message: "Select the navigation entry to open it.",
      });
    return true;
  };
