import { type PageLocation, type PageRef, resourceKey } from "@pstdio/sdk/extensions";
import {
  getWorkbenchSelectionResourceKeys,
  type NavigationTarget,
  type ResourceRef,
  type TreeNode,
  type TreeViewSection,
} from "../../../core";

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
const targetPanelResource = (target: NavigationTarget | undefined) => {
  if (!target) return undefined;
  const targets = target.kind === "compound" ? target.targets : [target];
  return [...targets].reverse().find((candidate) => candidate.kind === "panel")?.resource;
};
const resolveTreeNodeResourceKey = (node: TreeNode) => {
  const resource = node.resource ?? targetPanelResource(node.target);
  return resource ? resourceKey(resource) : undefined;
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
const pageRefsEqual = (left: PageRef, right: PageRef) => left.id === right.id && left.extensionId === right.extensionId;
const targetMatchesPage = (target: NavigationTarget | undefined, activePage: PageRef, activeResource?: ResourceRef) => {
  // A resource panel owns its selection; its containing page can host other open resources.
  if (!target || targetPanelResource(target)) return false;
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
  // Parent trees retain their document selection, but only the active context owns selection.
  const declaredSelection = activeNodeIds(
    listSectionNodes(sections, childrenByNodeId)
      .filter((node) => {
        if (!node.selected) return false;
        const nodeResourceKey = resolveTreeNodeResourceKey(node);
        if (!nodeResourceKey && !node.target) return true;
        if (nodeResourceKey && activeResourceKeys.includes(nodeResourceKey)) return true;
        return activeLocation ? targetMatchesPage(node.target, activeLocation.page, activeResource) : !activeResource;
      })
      .map((node) => node.id),
  );
  if (declaredSelection) return declaredSelection;
  const selectedNode = selectedNodeId ? findSectionNode(sections, selectedNodeId, childrenByNodeId) : undefined;
  const selectedResourceKey = selectedNode ? resolveTreeNodeResourceKey(selectedNode) : undefined;
  if (selectedResourceKey && activeResourceKeys.includes(selectedResourceKey)) return selectedNodeId;
  // Keep the selected document when several nodes target the same page and resource.
  if (activeLocation && targetMatchesPage(selectedNode?.target, activeLocation.page, activeResource)) {
    return selectedNodeId;
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
  if (selectedResourceKey) return undefined;
  return selectedNodeId;
};

export const resolveTreeSelectionIntent = (input: ResolveTreeListSelectionInput) => {
  if (!input.selectedNodeId) return undefined;
  const node = findSectionNode(input.sections, input.selectedNodeId, input.childrenByNodeId);
  if (!node) return undefined;
  const key = resolveTreeNodeResourceKey(node);
  if (!key && !node.target) return node.id;
  if (key && getWorkbenchSelectionResourceKeys(input.activeResource).includes(key)) return node.id;
  if (input.activeLocation && targetMatchesPage(node.target, input.activeLocation.page, input.activeResource))
    return node.id;
  return undefined;
};
