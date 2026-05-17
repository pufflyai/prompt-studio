import { Box } from "@chakra-ui/react";
import { Tooltip, type TreeListNode, type TreeListSection } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { TreeNode, TreeViewSection, WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { createTreeActionItems, createTreeContextMenuItems, createTreeMenuItems } from "./tree-actions";

interface TreeNodeRenderContext {
  workbench: WorkbenchCore;
  onCommandError?: (error: unknown) => void;
}

export const resolveTreeListActiveNodeId = (activeNodeId: string | null | undefined, selectedNodeId?: string) => {
  if (!activeNodeId) return selectedNodeId;
  if (!selectedNodeId || selectedNodeId === activeNodeId) return activeNodeId;

  return [activeNodeId, selectedNodeId];
};

const canVirtualizeTreeNode = (node: TreeListNode) => node.isContainer !== true && (node.children ?? []).length === 0;

export const canVirtualizeTreeSections = (sections: TreeListSection[]) =>
  sections.every((section) => section.nodes.every(canVirtualizeTreeNode));

const findNode = (nodes: TreeNode[], nodeId: string, childrenByNodeId: Record<string, TreeNode[]>): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findNode([...(node.children ?? []), ...(childrenByNodeId[node.id] ?? [])], nodeId, childrenByNodeId);
    if (child) return child;
  }

  return null;
};

export const findNodeInSections = (
  sections: TreeViewSection[],
  nodeId: string,
  childrenByNodeId: Record<string, TreeNode[]>,
) => {
  for (const section of sections) {
    const node = findNode(section.nodes, nodeId, childrenByNodeId);
    if (node) return node;
  }

  return null;
};

const wrapTreeNodeIcon = (icon: ReactNode, iconTooltip: string | undefined) => {
  if (!iconTooltip) return icon;

  return (
    <Tooltip content={iconTooltip} openDelay={300}>
      <Box as="span" display="inline-flex" alignItems="center" justifyContent="center">
        {icon}
      </Box>
    </Tooltip>
  );
};

const resolveTreeNodeIcon = (node: TreeNode): ReactNode | undefined => {
  let icon: ReactNode | undefined;
  if (node.iconElement !== undefined) {
    icon = node.iconElement as ReactNode;
  } else if (node.icon) {
    icon = <WorkbenchIcon name={node.icon} />;
  }

  return icon === undefined ? undefined : wrapTreeNodeIcon(icon, node.iconTooltip);
};

const resolveTreeNodeNavigationIntent = (node: TreeNode) => {
  if (node.target) return { id: "target", payload: node.target };
  if (node.resource) return { id: "resource", payload: node.resource };
  return undefined;
};

const toTreeListNode = (
  node: TreeNode,
  childrenByNodeId: Record<string, TreeNode[]>,
  context: TreeNodeRenderContext,
) => {
  const navigationIntent = resolveTreeNodeNavigationIntent(node);
  const menuItems = node.menuPath
    ? createTreeMenuItems({
        workbench: context.workbench,
        menuPath: node.menuPath,
        onCommandError: context.onCommandError,
      })
    : undefined;
  const contextMenuItems = createTreeContextMenuItems({
    actions: node.contextMenuActions,
    menuPath: node.contextMenuPath,
    workbench: context.workbench,
    onCommandError: context.onCommandError,
  });

  const treeNode: TreeListNode = {
    id: node.id,
    label: node.label,
    description: node.description,
    icon: resolveTreeNodeIcon(node),
    iconColor: node.iconColor,
    disabled: node.disabled,
    actions: createTreeActionItems({
      actions: node.actions,
      workbench: context.workbench,
      onCommandError: context.onCommandError,
    }),
    endContent: menuItems && menuItems.length > 0 ? <WorkbenchIcon name="ChevronRight" size={12} /> : undefined,
    menuItems,
    contextMenuItems: contextMenuItems.length > 0 ? contextMenuItems : undefined,
    ...(node.menuPlacement ? { menuPlacement: node.menuPlacement } : {}),
    isContainer: node.collapsible,
    isNavigable: Boolean(navigationIntent),
    navigationIntent,
    children: [...(node.children ?? []), ...(childrenByNodeId[node.id] ?? [])].map((child) =>
      toTreeListNode(child, childrenByNodeId, context),
    ),
  } as TreeListNode;

  return treeNode;
};

export const toTreeListSection = (
  section: TreeViewSection,
  childrenByNodeId: Record<string, TreeNode[]>,
  context: TreeNodeRenderContext,
): TreeListSection => ({
  id: section.id,
  label: section.label,
  actions: createTreeActionItems({
    actions: section.actions,
    workbench: context.workbench,
    onCommandError: context.onCommandError,
  }),
  collapsible: section.collapsible,
  nodes: section.nodes.map((node) => toTreeListNode(node, childrenByNodeId, context)),
});
