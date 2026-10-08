import { getWorkbenchRenderers, type NavigationTarget, type WorkbenchCore } from "../../../core";

export const shouldSelectTreeNodeForNavigationTarget = (target: NavigationTarget) => {
  const items = target.kind === "compound" ? target.targets : [target];
  return items.some((item) => item.kind === "page" || item.kind === "panel");
};

export const createToggleTreeSection =
  (workbench: WorkbenchCore, treeViewId: string, expandedIds: string[]) => (sectionId: string) => {
    getWorkbenchRenderers(workbench).setSectionExpanded(treeViewId, sectionId, !expandedIds.includes(sectionId));
  };
