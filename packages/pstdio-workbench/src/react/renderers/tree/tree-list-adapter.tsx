import { Box } from "@chakra-ui/react";
import type { PageLocation, PageRef } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { PaletteShortcut, Tooltip, type TreeListNode, type TreeListSection } from "@pstdio/ui";
import { DiffBubble } from "@pstdio/ui/diff";
import type { ReactNode } from "react";
import {
  getWorkbenchSelectionResourceKeys,
  type NavigationTarget,
  type ResourceRef,
  resourceContextMenuPath,
  type TreeNode,
  type TreeViewSection,
  type WorkbenchCore,
} from "../../../core";
import { WorkbenchIcon } from "../../shared/icon";
import { createTreeActionItems, createTreeContextMenuItems, type TreeActionParamsRequest } from "./tree-actions";

interface TreeNodeRenderContext {
  workbench: WorkbenchCore;
  onCommandError?: (error: unknown) => void;
  onRequestParams?: (request: TreeActionParamsRequest) => void;
  suppressContextMenus?: boolean;
}
export const resolveTreeListActiveNodeId = (activeNodeId: string | null | undefined, selectedNodeId?: string) => {
  if (!activeNodeId) return selectedNodeId;
  return activeNodeId;
};
interface ResolveTreeListSelectionInput {
  sections: TreeViewSection[];
  childrenByNodeId: Record<string, TreeNode[]>;
  activeNodeId?: string | null;
  activeLocation?: PageLocation;
  activeResource?: ResourceRef;
  selectedNodeId?: string;
}
const activeNodeIds = (ids: string[]) => {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return undefined;
  return uniqueIds.length === 1 ? uniqueIds[0] : uniqueIds;
};
const resolveTreeNodeResourceKey = (node: TreeNode) => {
  if (node.resource) return resourceKey(node.resource);
  return undefined;
};
const listTreeNodes = (nodes: TreeNode[], childrenByNodeId: Record<string, TreeNode[]>): TreeNode[] =>
  nodes.flatMap((node) => [
    node,
    ...listTreeNodes([...(node.children ?? []), ...(childrenByNodeId[node.id] ?? [])], childrenByNodeId),
  ]);
const listSectionNodes = (sections: TreeViewSection[], childrenByNodeId: Record<string, TreeNode[]>) =>
  sections.flatMap((section) => listTreeNodes(section.nodes, childrenByNodeId));
const resolveActiveResourceNodeIds = (
  sections: TreeViewSection[],
  childrenByNodeId: Record<string, TreeNode[]>,
  resourceKeys: string[],
) => {
  const nodes = listSectionNodes(sections, childrenByNodeId);
  for (const resourceKey of resourceKeys) {
    const matches = nodes
      .filter((node) => node.id === resourceKey || resolveTreeNodeResourceKey(node) === resourceKey)
      .map((node) => node.id);
    if (matches.length > 0) return activeNodeIds(matches);
  }
  return undefined;
};
const findSectionNode = (sections: TreeViewSection[], nodeId: string, childrenByNodeId: Record<string, TreeNode[]>) =>
  listSectionNodes(sections, childrenByNodeId).find((node) => node.id === nodeId);
export const filterTreeListSelection = (
  sections: TreeViewSection[],
  childrenByNodeId: Record<string, TreeNode[]>,
  selection: string | string[] | undefined,
) => {
  const selectedIds = typeof selection === "string" ? [selection] : (selection ?? []);
  return activeNodeIds(selectedIds.filter((nodeId) => findSectionNode(sections, nodeId, childrenByNodeId)));
};
const pageRefsEqual = (left: PageRef, right: PageRef) => left.id === right.id && left.extensionId === right.extensionId;
const targetMatchesPage = (target: NavigationTarget | undefined, activePage: PageRef, activeResource?: ResourceRef) => {
  if (!target) return false;
  const targets = target.kind === "compound" ? target.targets : [target];
  return targets.some(
    (candidate) =>
      candidate.kind === "page" &&
      pageRefsEqual(candidate.page, activePage) &&
      (candidate.resource
        ? activeResource !== undefined && resourceKey(candidate.resource) === resourceKey(activeResource)
        : activeResource === undefined),
  );
};
const resolveActivePageNodeIds = (
  sections: TreeViewSection[],
  childrenByNodeId: Record<string, TreeNode[]>,
  activePage: PageRef | undefined,
  activeResource: ResourceRef | undefined,
) => {
  if (!activePage) return undefined;
  return activeNodeIds(
    listSectionNodes(sections, childrenByNodeId)
      .filter((node) => targetMatchesPage(node.target, activePage, activeResource))
      .map((node) => node.id),
  );
};
export const resolveTreeListSelection = (input: ResolveTreeListSelectionInput) => {
  const { sections, childrenByNodeId, activeNodeId, activeLocation, activeResource, selectedNodeId } = input;
  if (activeNodeId) return activeNodeId;
  const activeResourceKeys = getWorkbenchSelectionResourceKeys(activeResource);
  let selectedResourceKey: string | undefined;
  if (selectedNodeId) {
    const selectedNode = findSectionNode(sections, selectedNodeId, childrenByNodeId);
    selectedResourceKey = selectedNode ? resolveTreeNodeResourceKey(selectedNode) : undefined;
    if (selectedResourceKey && activeResourceKeys.includes(selectedResourceKey)) return selectedNodeId;
  }
  const activeResourceNodeId = resolveActiveResourceNodeIds(sections, childrenByNodeId, activeResourceKeys);
  if (activeResourceNodeId) return activeResourceNodeId;
  const activePageNodeId = resolveActivePageNodeIds(
    sections,
    childrenByNodeId,
    activeLocation?.page,
    activeLocation?.resource,
  );
  if (activePageNodeId) return activePageNodeId;
  if (!selectedNodeId) return undefined;
  if (activeResourceKeys.length > 0 && selectedResourceKey) return undefined;
  return selectedNodeId;
};
const canVirtualizeTreeNode = (node: TreeListNode) =>
  node.inlineInput === undefined && node.isContainer !== true && (node.children ?? []).length === 0;
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
const resolveTreeNodeResource = (node: TreeNode): ResourceRef | undefined => {
  if (node.resource) return node.resource;
  return undefined;
};
const renderShortcutEndContent = (binding: string | string[] | undefined) => {
  if (!binding) return undefined;
  return (
    <Box
      opacity="0"
      pointerEvents="none"
      display="inline-flex"
      alignItems="center"
      transition="opacity 120ms ease"
      _groupHover={{ opacity: "1" }}
    >
      <PaletteShortcut binding={binding} />
    </Box>
  );
};
const resolveTreeNodeEndContent = (
  node: TreeNode,
  resource: ResourceRef | undefined,
  binding: string | string[] | undefined,
) => {
  if (node.endContent !== undefined) return node.endContent as ReactNode;
  const shortcut = renderShortcutEndContent(binding);
  if (shortcut) return shortcut;
  const additions = resource?.metadata?.diffAdditions;
  const deletions = resource?.metadata?.diffDeletions;
  if (resource?.type !== "workspace" || typeof additions !== "number" || typeof deletions !== "number") {
    return undefined;
  }
  return <DiffBubble additions={additions} deletions={deletions} variant="ghost" size="small" />;
};
const toTreeListSectionEmptyNode = (section: TreeViewSection): TreeListNode | undefined => {
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
  const contextMenuItems = createTreeContextMenuItems({
    actions: node.contextMenuActions,
    menuPath: node.contextMenuPath ?? node.menuPath ?? (resource ? resourceContextMenuPath(resource.type) : undefined),
    workbench: context.workbench,
    context: commandContext,
    onCommandError: context.onCommandError,
    onRequestParams: context.onRequestParams,
  });
  const menuItems = node.menuPath && contextMenuItems.length > 0 ? contextMenuItems : undefined;
  const shortcuts = new Map(
    context.workbench.keybindings.listCommandKeybindings().map((k) => [k.commandId, k.keybinding]),
  );
  const binding = node.commandId ? shortcuts.get(node.commandId) : undefined;
  const treeNode: TreeListNode = {
    id: node.id,
    moveScope: node.moveScope,
    label: node.label,
    description: node.description,
    icon: resolveTreeNodeIcon(node),
    iconColor: node.iconColor,
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
    endContent: resolveTreeNodeEndContent(node, resource, binding),
    menuItems,
    contextMenuItems: !context.suppressContextMenus && contextMenuItems.length > 0 ? contextMenuItems : undefined,
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
