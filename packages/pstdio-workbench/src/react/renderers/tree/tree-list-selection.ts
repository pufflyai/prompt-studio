import { type PageLocation, type PageRef, type PageSlotRef, resourceKey } from "@pstdio/sdk/extensions";
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
  activeSlot?: Pick<PageSlotRef, "page" | "id">;
  selectedNodeId?: string;
  resourceReferenceKey?: (resource: ResourceRef) => string;
}
const activeNodeIds = (ids: string[]) => {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return undefined;
  return uniqueIds.length === 1 ? uniqueIds[0] : uniqueIds;
};
const targetsContent = (target: NavigationTarget | undefined) => {
  const targets = target?.kind === "compound" ? target.targets : [target];
  return targets.some((item) => item?.kind === "page" || item?.kind === "panel");
};
const targetPanel = (target: NavigationTarget | undefined) => {
  if (!target) return undefined;
  const targets = target.kind === "compound" ? target.targets : [target];
  return [...targets].reverse().find((candidate) => candidate.kind === "panel");
};
const resolveTreeNodeResourceKey = (node: TreeNode) => {
  const resource = node.resource ?? targetPanel(node.target)?.resource;
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
const targetMatchesSlot = (target: NavigationTarget | undefined, slot: ResolveTreeListSelectionInput["activeSlot"]) => {
  const panel = targetPanel(target)?.panel;
  return slot && panel?.kind === "page-slot" && panel.id === slot.id && pageRefsEqual(panel.page, slot.page);
};
const pageResourceMatches = (
  target: ResourceRef,
  active: ResourceRef,
  referenceKey: (resource: ResourceRef) => string,
  includeDocuments: boolean,
) => {
  const key = referenceKey(target);
  if (key === referenceKey(active)) return true;
  if (!includeDocuments || key !== referenceKey({ ...target, metadata: undefined })) return false;
  // A resource page owns its documents. An explicit document target keeps its exact identity.
  return key === referenceKey({ ...active, metadata: target.metadata });
};
const targetMatchesPage = (
  target: NavigationTarget | undefined,
  activePage: PageRef,
  activeResource?: ResourceRef,
  referenceKey: (resource: ResourceRef) => string = resourceKey,
  includeDocuments = false,
) => {
  // A panel target can focus one tab among several on the containing page.
  const panel = targetPanel(target);
  if (!target || panel?.resource || panel?.panel.kind === "page-slot") return false;
  const targets = target.kind === "compound" ? target.targets : [target];
  return targets.some(
    (candidate) =>
      candidate.kind === "page" &&
      pageRefsEqual(candidate.page, activePage) &&
      (candidate.resource
        ? activeResource !== undefined &&
          pageResourceMatches(candidate.resource, activeResource, referenceKey, includeDocuments)
        : activeResource === undefined),
  );
};
const resolveActivePageNodeIds = (
  sections: TreeViewSection[],
  childrenByNodeId: Record<string, TreeNode[]>,
  activeLocation: PageLocation | undefined,
  referenceKey: (resource: ResourceRef) => string = resourceKey,
) => {
  const nodes = listSectionNodes(sections, childrenByNodeId);
  for (let location = activeLocation; location; location = location.parent) {
    for (const includeDocuments of [false, true]) {
      const matches = activeNodeIds(
        nodes
          .filter((node) =>
            targetMatchesPage(node.target, location.page, location.resource, referenceKey, includeDocuments),
          )
          .map((node) => node.id),
      );
      if (matches) return matches;
    }
  }
  return undefined;
};
export const resolveTreeListSelection = (input: ResolveTreeListSelectionInput) => {
  const { sections, childrenByNodeId, activeNodeId, activeLocation, activeResource, activeSlot, selectedNodeId } =
    input;
  const referenceKey = input.resourceReferenceKey ?? resourceKey;
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
        if (targetMatchesSlot(node.target, activeSlot)) return true;
        return activeLocation
          ? targetMatchesPage(node.target, activeLocation.page, activeResource, referenceKey)
          : !activeResource && !targetsContent(node.target);
      })
      .map((node) => node.id),
  );
  if (declaredSelection) return declaredSelection;
  const selectedNode = selectedNodeId ? findSectionNode(sections, selectedNodeId, childrenByNodeId) : undefined;
  const selectedResourceKey = selectedNode ? resolveTreeNodeResourceKey(selectedNode) : undefined;
  if (selectedResourceKey && activeResourceKeys.includes(selectedResourceKey)) return selectedNodeId;
  // Keep the selected document when several nodes target the same page and resource.
  if (activeLocation && targetMatchesPage(selectedNode?.target, activeLocation.page, activeResource, referenceKey)) {
    return selectedNodeId;
  }
  const activeResourceNodeId = resolveActiveResourceNodeIds(sections, childrenByNodeId, activeResourceKeys);
  if (activeResourceNodeId) return activeResourceNodeId;
  if (activeSlot) {
    const slotNodeId = listSectionNodes(sections, childrenByNodeId).find((node) =>
      targetMatchesSlot(node.target, activeSlot),
    )?.id;
    if (slotNodeId) return slotNodeId;
  }
  const activePageNodeId = resolveActivePageNodeIds(sections, childrenByNodeId, activeLocation, referenceKey);
  if (activePageNodeId) return activePageNodeId;
  if (!selectedNodeId) return undefined;
  if (selectedResourceKey || targetsContent(selectedNode?.target)) return undefined;
  return selectedNodeId;
};

export const resolveTreeSelectionIntent = (input: ResolveTreeListSelectionInput) => {
  if (!input.selectedNodeId) return undefined;
  const node = findSectionNode(input.sections, input.selectedNodeId, input.childrenByNodeId);
  if (!node) return undefined;
  const key = resolveTreeNodeResourceKey(node);
  if (!key && !node.target) return node.id;
  if (key && getWorkbenchSelectionResourceKeys(input.activeResource).includes(key)) return node.id;
  if (targetMatchesSlot(node.target, input.activeSlot)) return node.id;
  if (
    input.activeLocation &&
    targetMatchesPage(node.target, input.activeLocation.page, input.activeResource, input.resourceReferenceKey, true)
  )
    return node.id;
  for (let location = input.activeLocation?.parent; location; location = location.parent) {
    if (targetMatchesPage(node.target, location.page, location.resource, input.resourceReferenceKey, true))
      return node.id;
  }
  return undefined;
};
