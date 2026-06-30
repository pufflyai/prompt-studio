import { Box } from "@chakra-ui/react";
import { PaletteShortcut, Tooltip, type TreeListNode, type TreeListSection } from "@pstdio/ui";
import { DiffBubble } from "@pstdio/ui/diff";
import type { ReactNode } from "react";
import {
  getWorkbenchSelectionResourceUris,
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
}

export const resolveTreeListActiveNodeId = (activeNodeId: string | null | undefined, selectedNodeId?: string) => {
  if (!activeNodeId) return selectedNodeId;
  return activeNodeId;
};

interface ResolveTreeListSelectionInput {
  sections: TreeViewSection[];
  childrenByNodeId: Record<string, TreeNode[]>;
  activeNodeId?: string | null;
  activeResource?: ResourceRef;
  selectedNodeId?: string;
}

const activeNodeIds = (ids: string[]) => {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return undefined;
  return uniqueIds.length === 1 ? uniqueIds[0] : uniqueIds;
};

const resolveTreeNodeResourceUri = (node: TreeNode) => {
  if (node.resource) return node.resource.uri;
  if (node.target?.kind === "resource") return node.target.resource.uri;
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
  resourceUris: string[],
) => {
  const nodes = listSectionNodes(sections, childrenByNodeId);

  for (const resourceUri of resourceUris) {
    const matches = nodes
      .filter((node) => node.id === resourceUri || resolveTreeNodeResourceUri(node) === resourceUri)
      .map((node) => node.id);
    if (matches.length > 0) return activeNodeIds(matches);
  }

  return undefined;
};

const findSectionNode = (sections: TreeViewSection[], nodeId: string, childrenByNodeId: Record<string, TreeNode[]>) =>
  listSectionNodes(sections, childrenByNodeId).find((node) => node.id === nodeId);

export const resolveTreeListSelection = (input: ResolveTreeListSelectionInput) => {
  const { sections, childrenByNodeId, activeNodeId, activeResource, selectedNodeId } = input;
  if (activeNodeId) return activeNodeId;

  const activeResourceUris = getWorkbenchSelectionResourceUris(activeResource);
  const activeResourceNodeId = resolveActiveResourceNodeIds(sections, childrenByNodeId, activeResourceUris);
  if (activeResourceNodeId) return activeResourceNodeId;

  if (!selectedNodeId) return undefined;
  const selectedNode = findSectionNode(sections, selectedNodeId, childrenByNodeId);
  const selectedResourceUri = selectedNode ? resolveTreeNodeResourceUri(selectedNode) : undefined;
  if (activeResourceUris.length > 0 && selectedResourceUri) return undefined;

  return selectedNodeId;
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

const resolveTreeNodeResource = (node: TreeNode): ResourceRef | undefined => {
  if (node.resource) return node.resource;
  if (node.target?.kind === "resource") return node.target.resource;
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
  if (resource?.kind !== "workspace" || typeof additions !== "number" || typeof deletions !== "number") {
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
    menuPath: node.contextMenuPath ?? node.menuPath ?? (resource ? resourceContextMenuPath(resource.kind) : undefined),
    workbench: context.workbench,
    context: commandContext,
    onCommandError: context.onCommandError,
    onRequestParams: context.onRequestParams,
  });
  const menuItems = node.menuPath && contextMenuItems.length > 0 ? contextMenuItems : undefined;
  const shortcuts = new Map(
    context.workbench.keybindings.listActiveKeybindings().map((k) => [k.commandId, k.keybinding]),
  );
  const binding = node.commandId ? shortcuts.get(node.commandId) : undefined;

  const treeNode: TreeListNode = {
    id: node.id,
    label: node.label,
    description: node.description,
    icon: resolveTreeNodeIcon(node),
    iconColor: node.iconColor,
    disabled: node.disabled,
    rowVariant: node.rowVariant,
    canHide: node.canHide,
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
) => {
  const emptyNode = toTreeListSectionEmptyNode(section);

  return {
    id: section.id,
    label: section.label,
    actions: createTreeActionItems({
      actions: section.actions,
      workbench: context.workbench,
      onCommandError: context.onCommandError,
      onRequestParams: context.onRequestParams,
    }),
    collapsible: section.collapsible,
    canHide: section.canHide,
    hiddenByDefault: section.hiddenByDefault,
    nodes: emptyNode ? [emptyNode] : section.nodes.map((node) => toTreeListNode(node, childrenByNodeId, context)),
  };
};
