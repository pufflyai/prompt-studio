import { useId } from "react";
import { getWorkbenchRenderers, type WorkbenchCore, type WorkbenchWidgetPlacement } from "../../core";
import { toPanelInstance } from "../../core/registries/layout/panel-api";
import type { LoadedTreeData } from "../renderers/tree/tree-view-load";
import { useTreeRead } from "../renderers/tree/use-tree-read";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const treeMenuHasContent = (data: LoadedTreeData) =>
  [...data.header, ...data.body, ...data.footer].some(
    (section) => section.nodes.length > 0 || Boolean(section.actions?.length) || Boolean(section.nextPage),
  );

/** Empty native tree menus have no controls to expose; errors retain their recovery surface. */
export const usePanelMenuContent = (workbench: WorkbenchCore, placement?: WorkbenchWidgetPlacement) => {
  const owner = useId();
  const trees = getWorkbenchRenderers(workbench);
  const treeId = placement?.viewId ?? "";
  const tree = useWorkbenchStore(trees.treeStore, (state) => state.trees[treeId]);
  const config = placement && workbench.layout.getPanel(placement.contributionId)?.config;
  const viewId =
    config && typeof config === "object" && "viewContextId" in config && typeof config.viewContextId === "string"
      ? config.viewContextId
      : placement?.viewId;
  const { read } = useTreeRead(
    workbench,
    treeId,
    placement?.resource,
    viewId,
    undefined,
    `panel-menu-content:${owner}`,
    placement ? toPanelInstance(placement) : undefined,
    Boolean(tree),
  );
  return !tree || Boolean(read.error) || Boolean(read.value && treeMenuHasContent(read.value));
};
