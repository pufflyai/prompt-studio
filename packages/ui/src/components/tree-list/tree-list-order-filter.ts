import type { TreeListSection } from "./tree-list.types";

const reorderBy = <T extends { id: string }>(items: T[], order: string[]): T[] => {
  if (order.length === 0) return items;

  const indexById = new Map(items.map((item, index) => [item.id, index]));
  const placed = new Set<number>();
  const next: T[] = [];

  for (const id of order) {
    const index = indexById.get(id);
    if (index === undefined || placed.has(index)) continue;
    placed.add(index);
    next.push(items[index]);
  }

  let changed = next.length > 0 && next.length !== items.length;
  for (let i = 0; i < items.length; i += 1) {
    if (placed.has(i)) continue;
    if (next.length !== i && !changed) changed = true;
    next.push(items[i]);
  }

  if (!changed) {
    for (let i = 0; i < items.length; i += 1) {
      if (items[i] !== next[i]) {
        changed = true;
        break;
      }
    }
  }

  return changed ? next : items;
};

export const applyTreeListOrder = (
  sections: TreeListSection[],
  sectionOrder: string[],
  nodeOrderBySection: Record<string, string[]>,
): TreeListSection[] => {
  let changed = false;
  const reorderedSections = reorderBy(sections, sectionOrder);
  if (reorderedSections !== sections) changed = true;

  const nodesById = new Map(sections.flatMap((section) => section.nodes.map((node) => [node.id, node] as const)));
  const assignedNodeIds = new Set(
    Object.entries(nodeOrderBySection)
      .filter(([sectionId]) => sections.some((section) => section.id === sectionId))
      .flatMap(([, nodeIds]) => nodeIds.filter((nodeId) => nodesById.has(nodeId))),
  );

  const next: TreeListSection[] = [];
  for (const section of reorderedSections) {
    const nodeOrder = nodeOrderBySection[section.id];
    if (!(section.id in nodeOrderBySection)) {
      const remainingNodes = section.nodes.filter((node) => !assignedNodeIds.has(node.id));
      if (remainingNodes.length === section.nodes.length) next.push(section);
      else {
        changed = true;
        next.push({ ...section, nodes: remainingNodes });
      }
      continue;
    }

    const orderedNodes = (nodeOrder ?? []).flatMap((nodeId) => {
      const node = nodesById.get(nodeId);
      return node ? [node] : [];
    });
    const remainingNodes = section.nodes.filter((node) => !assignedNodeIds.has(node.id));
    const reorderedNodes = [...orderedNodes, ...remainingNodes];
    if (
      reorderedNodes.length !== section.nodes.length ||
      reorderedNodes.some((node, index) => node !== section.nodes[index])
    ) {
      changed = true;
      next.push({ ...section, nodes: reorderedNodes });
    } else {
      next.push(section);
    }
  }

  return changed ? next : sections;
};
