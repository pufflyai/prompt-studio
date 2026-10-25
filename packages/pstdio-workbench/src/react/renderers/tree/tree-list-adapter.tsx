import { Badge, Box, Spinner } from "@chakra-ui/react";
import { Tooltip, type TreeListActionMenuItem, type TreeListNode } from "@pstdio/ui";
import { DiffBubble } from "@pstdio/ui/diff";
import type { ReactNode } from "react";
import {
  type ResourceRef,
  resourceContextMenuPath,
  type TreeNode,
  type TreeViewSection,
  type WorkbenchCore,
} from "../../../core";
import { createWorkbenchResourceActions } from "../../menus/resource-actions";
import { WorkbenchIcon } from "../../shared/icon";
import { createTreeActionItems, createTreeContextMenuItems, type TreeActionParamsRequest } from "./tree-actions";

interface TreeNodeRenderContext {
  workbench: WorkbenchCore;
  onCommandError?: (error: unknown) => void;
  onRequestParams?: (request: TreeActionParamsRequest) => void;
}
export const resolveTreeListActiveNodeId = (activeNodeId: string | null | undefined, selectedNodeId?: string) => {
  if (!activeNodeId) return selectedNodeId;
  return activeNodeId;
};
export { resolveTreeListSelection } from "./tree-list-selection";

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
    <Tooltip content={iconTooltip}>
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
const resolveTreeNodeResource = (node: TreeNode): ResourceRef | undefined => {
  if (node.resource) return node.resource;
  return undefined;
};
const resolveTreeNodeEndContent = (node: TreeNode, resource: ResourceRef | undefined) => {
  if (node.endContent !== undefined) return node.endContent as ReactNode;
  if (node.badge) {
    return (
      <Badge size="sm" variant="subtle" colorPalette={node.badge.color ?? "gray"} flexShrink={0}>
        {node.badge.label}
      </Badge>
    );
  }
  const additions = resource?.metadata?.diffAdditions;
  const deletions = resource?.metadata?.diffDeletions;
  if (resource?.type !== "workspace" || typeof additions !== "number" || typeof deletions !== "number") {
    return undefined;
  }
  return <DiffBubble additions={additions} deletions={deletions} variant="ghost" size="small" />;
};
const toTreeListSectionEmptyNode = (section: TreeViewSection): TreeListNode | undefined => {
  if (section.loading && section.nodes.length === 0)
    return {
      id: `${section.id}:loading`,
      label: "Loading…",
      icon: <Spinner size="xs" />,
      disabled: true,
      rowVariant: "empty-state",
    };
  if (!section.emptyState || section.nodes.length > 0) return undefined;
  return {
    id: `${section.id}:empty`,
    label: section.emptyState.title,
    description: section.emptyState.description,
    icon: section.emptyState.icon ? <WorkbenchIcon name={section.emptyState.icon} /> : undefined,
    disabled: true,
    rowVariant: "empty-state",
  };
};
const toTreeListNode = (
  node: TreeNode,
  childrenByNodeId: Record<string, TreeNode[]>,
  context: TreeNodeRenderContext,
) => {
  const navigationIntent = resolveTreeNodeNavigationIntent(node);
  const resource = resolveTreeNodeResource(node);
  const commandContext = resource ? { resource } : undefined;
  const customPath = node.contextMenuPath ?? node.menuPath;
  const resourcePath = resource ? resourceContextMenuPath(resource.type) : undefined;
  // Building a row menu resolves commands, context, and shortcuts. Large trees adapt every row but mount only
  // the visible ones, so the getters below build a menu when the rendered row first reads it. Copying the
  // node with a spread reads both getters immediately.
  let menuItems: TreeListActionMenuItem[] | undefined;
  const resolveMenuItems = () => {
    if (menuItems) return menuItems;
    const sharedActions = resource
      ? createWorkbenchResourceActions(context.workbench, resource, {
          onRequestParams: context.onRequestParams,
          onCommandError: context.onCommandError,
        }).map((action) => ({
          id: action.key,
          label: action.label,
          commandId: action.commandId,
          icon: action.icon,
          group: action.group,
          disabled: action.isDisabled,
          endContent: action.endContent,
          separatorBefore: action.separatorBefore,
          onAction: () => {
            void action.onClick?.();
          },
        }))
      : [];
    menuItems = [
      ...sharedActions,
      ...createTreeContextMenuItems({
        actions: node.contextMenuActions,
        menuPath: customPath?.join("/") !== resourcePath?.join("/") ? customPath : undefined,
        workbench: context.workbench,
        context: commandContext,
        onCommandError: context.onCommandError,
        onRequestParams: context.onRequestParams,
      }),
    ];
    return menuItems;
  };
  const treeNode: TreeListNode = {
    id: node.id,
    moveScope: node.moveScope,
    label: node.label,
    description: node.description,
    icon: resolveTreeNodeIcon(node),
    iconColor: node.iconColor,
    tooltip: node.tooltip,
    disabled: node.disabled,
    rowVariant: node.rowVariant,
    inlineInput: node.inlineInput,
    showContextMenuTrigger: node.showContextMenuTrigger,
    canHide: node.canHide,
    canReorder: node.canReorder,
    canDrag: node.canDrag,
    canDrop: node.canDrop,
    hiddenByDefault: node.hiddenByDefault,
    actions: createTreeActionItems({
      actions: node.actions,
      workbench: context.workbench,
      context: commandContext,
      onCommandError: context.onCommandError,
      onRequestParams: context.onRequestParams,
    }),
    endContent: resolveTreeNodeEndContent(node, resource),
    get menuItems() {
      if (!node.menuPath) return undefined;
      const items = resolveMenuItems();
      return items.length > 0 ? items : undefined;
    },
    get contextMenuItems() {
      const items = resolveMenuItems();
      return items.length > 0 ? items : undefined;
    },
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
) => {
  const emptyNode = toTreeListSectionEmptyNode(section);
  return {
    id: section.id,
    moveScope: section.moveScope,
    label: section.label,
    menuLabel: section.menuLabel,
    actions: createTreeActionItems({
      actions: section.actions,
      workbench: context.workbench,
      onCommandError: context.onCommandError,
      onRequestParams: context.onRequestParams,
    }),
    collapsible: section.collapsible,
    canHide: section.canHide,
    canReorder: section.canReorder,
    hiddenByDefault: section.hiddenByDefault,
    nodes: emptyNode ? [emptyNode] : section.nodes.map((node) => toTreeListNode(node, childrenByNodeId, context)),
  };
};
