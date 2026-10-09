import type { TreeListSection } from "./tree-list.types";
import type { TreeListGroup } from "./tree-list-order.store";

const keepFixedPositions = <T extends { id: string; canReorder?: boolean }>(original: T[], ordered: T[]) => {
  const movable = ordered.filter((item) => item.canReorder !== false);
  let index = 0;
  const fixed = original
    .map((item) => (item.canReorder === false ? item : movable[index++]))
    .filter((item): item is T => Boolean(item));
  fixed.push(...movable.slice(index));
  return fixed.every((item, index) => item === ordered[index]) && fixed.length === ordered.length ? ordered : fixed;
};

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
  groups: TreeListGroup[] = [],
): TreeListSection[] => {
  const nodesById = new Map(sections.flatMap((section) => section.nodes.map((node) => [node.id, node] as const)));
  const groupedSections: TreeListSection[] = groups.length
    ? [...sections, ...groups.map((group) => ({ ...group, canHide: true, nodes: [] }))]
    : sections;
  // Order entries for ids no contributor declares are bare runs users made by dropping rows behind a group.
  // They exist while at least one of their rows does.
  const looseSections = Object.entries(nodeOrderBySection).flatMap(([id, nodeIds]) => {
    if (groupedSections.some((section) => section.id === id)) return [];
    const first = nodeIds.map((nodeId) => nodesById.get(nodeId)).find((node) => node && node.canReorder !== false);
    return first ? [{ id, moveScope: first.moveScope, nodes: [] }] : [];
  });
  const allSections = looseSections.length > 0 ? [...groupedSections, ...looseSections] : groupedSections;

  let changed = allSections !== sections;
  const reorderedSections = keepFixedPositions(allSections, reorderBy(allSections, sectionOrder));
  if (reorderedSections !== allSections) changed = true;

  const assignedNodeIds = new Set(
    Object.entries(nodeOrderBySection)
      .filter(([sectionId]) => allSections.some((section) => section.id === sectionId))
      .flatMap(([, nodeIds]) =>
        nodeIds.filter((nodeId) => nodesById.has(nodeId) && nodesById.get(nodeId)?.canReorder !== false),
      ),
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
      return node && node.canReorder !== false ? [node] : [];
    });
    const remainingNodes = section.nodes.filter((node) => !assignedNodeIds.has(node.id));
    const reorderedNodes = keepFixedPositions(section.nodes, [...orderedNodes, ...remainingNodes]);
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
