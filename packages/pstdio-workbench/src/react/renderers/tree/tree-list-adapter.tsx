import { Box } from "@chakra-ui/react";
import { DiffBubble, EmptyState, Tooltip, type TreeListNode, type TreeListSection } from "@pstdio/ui";
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

const resolveTreeNodeEndContent = (resource: ResourceRef | undefined, hasMenuItems: boolean) => {
  if (hasMenuItems) return <WorkbenchIcon name="ChevronRight" size={12} />;

  const additions = resource?.metadata?.diffAdditions;
  const deletions = resource?.metadata?.diffDeletions;
  if (resource?.kind !== "workspace" || typeof additions !== "number" || typeof deletions !== "number") {
    return undefined;
  }

  return <DiffBubble additions={additions} deletions={deletions} variant="ghost" size="small" />;
};

const toTreeListSectionEmptyState = (section: TreeViewSection) => {
  if (!section.emptyState) return undefined;
  return (
    <EmptyState
      title={section.emptyState.title}
      description={section.emptyState.description}
      icon={section.emptyState.icon ? <WorkbenchIcon name={section.emptyState.icon} /> : undefined}
      size="sm"
      px="sm"
      py="md"
      minH="6rem"
    />
  );
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
  const hasMenuItems = !!menuItems && menuItems.length > 0;

  const treeNode: TreeListNode = {
    id: node.id,
    label: node.label,
    description: node.description,
    icon: resolveTreeNodeIcon(node),
    iconColor: node.iconColor,
    disabled: node.disabled,
    canHide: node.canHide,
    hiddenByDefault: node.hiddenByDefault,
    actions: createTreeActionItems({
      actions: node.actions,
      workbench: context.workbench,
      context: commandContext,
      onCommandError: context.onCommandError,
      onRequestParams: context.onRequestParams,
    }),
    endContent: resolveTreeNodeEndContent(resource, hasMenuItems),
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
    onRequestParams: context.onRequestParams,
  }),
  collapsible: section.collapsible,
  canHide: section.canHide,
  hiddenByDefault: section.hiddenByDefault,
  emptyState: toTreeListSectionEmptyState(section),
  nodes: section.nodes.map((node) => toTreeListNode(node, childrenByNodeId, context)),
});
