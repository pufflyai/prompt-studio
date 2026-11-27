import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { useId } from "react";
import { getWorkbenchRenderers, type TreeNode, type WorkbenchCore, type WorkbenchWidgetPlacement } from "../../core";
import { getResourceMenuPage } from "../../core/controllers/panel-menus/resource-menu-page";
import { toPanelInstance } from "../../core/registries/layout/panel-api";
import type { LoadedTreeData } from "../renderers/tree/tree-view-load";
import { useTreeRead } from "../renderers/tree/use-tree-read";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const treeMenuHasContent = (data: LoadedTreeData, resource?: ResourceRef, documentKey?: string) => {
  const sections = [...data.header, ...data.body, ...data.footer];
  const self = (node: TreeNode) => {
    if (!resource || !node.resource || node.collapsible || node.children?.length || node.nextPage) return false;
    const targetResource = node.target && "resource" in node.target ? node.target.resource : undefined;
    const rowResource = targetResource ?? node.resource;
    return (
      resourceKey(rowResource) === resourceKey(resource) &&
      (!documentKey || rowResource.metadata?.[documentKey] === resource.metadata?.[documentKey])
    );
  };
  if (
    sections.some((section) => section.nodes.some(self)) &&
    sections.every(
      (section) => !section.nextPage && section.nodes.every((node) => !node.nextPage && (node.disabled || self(node))),
    )
  )
    return false;
  return sections.some(
    (section) => section.nodes.length > 0 || Boolean(section.actions?.length) || Boolean(section.nextPage),
  );
};

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
  const resource =
    viewId && workbench.viewMenus.getViewMenu(viewId)?.purpose === "resources" ? placement?.resource : undefined;
  const documentKey = resource && getResourceMenuPage(workbench, treeId)?.document?.metadataKey;
  return !tree || Boolean(read.error) || Boolean(read.value && treeMenuHasContent(read.value, resource, documentKey));
};
