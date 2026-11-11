import type { TreeListNode } from "@pstdio/ui";
import type { NavigationTarget, WorkbenchCore, WorkbenchPanelRegion } from "../../../core";
import { openDroppedPage, panelResourcePageTarget } from "../../../core/controllers/composition/panel-page-drop";
import { reportUserActionError } from "../../../core/shared/run-user-action";

export const treeTabTarget = (workbench: WorkbenchCore, target: NavigationTarget, region: WorkbenchPanelRegion) => {
  if (target.kind === "panel") return { ...target, region, open: "pin" as const };
  if (target.kind !== "page") return;
  if (region === "main") return { ...target, open: "pin" as const };
  const page = workbench.pages
    .listPages()
    .find((page) => page.ref.id === target.page.id && page.ref.extensionId === target.page.extensionId);
  if (!page?.panelView) return;
  return { kind: "panel" as const, panel: page.panelView, resource: target.resource, region, open: "pin" as const };
};

export const treePageTarget = (workbench: WorkbenchCore, intent: NavigationTarget) => {
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
    if (
      !header &&
      element?.closest('[data-workbench-panel="main"]') &&
      !workbench.shell.getPanelPolicy("main").acceptsTabs
    ) {
      return openTreePage(workbench, node);
    }
    const region = header?.getAttribute("data-workbench-panel-header");
    if (region !== "main" && region !== "side" && region !== "secondary") return false;
    if (node.navigationIntent?.id !== "target") return true;
    const target = treeTabTarget(workbench, node.navigationIntent.payload as NavigationTarget, region);
    if (target)
      void workbench.navigation
        .openTarget(target)
        .catch((error) => reportUserActionError(workbench, "Open tab", error));
    else
      workbench.notifications.show({
        level: "info",
        title: "This page opens in Main",
        message: "Select the navigation entry to open it.",
      });
    return true;
  };
