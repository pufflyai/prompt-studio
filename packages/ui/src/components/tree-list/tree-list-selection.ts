import type { TreeListNode, TreeListSection } from "./tree-list.types";

interface SelectionModifiers {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export const selectTreeListNodes = (
  visibleIds: string[],
  selectedIds: string[],
  id: string,
  anchor: string | undefined,
  modifiers: SelectionModifiers,
) => {
  if (modifiers.shiftKey && anchor && visibleIds.includes(anchor)) {
    const start = visibleIds.indexOf(anchor);
    const end = visibleIds.indexOf(id);
    return visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1);
  }
  if (modifiers.ctrlKey || modifiers.metaKey) {
    return selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id];
  }
  return [id];
};

export const treeListSiblingMove = (
  sections: TreeListSection[],
  id: string,
  direction: -1 | 1,
  selectedIds: string[] = [],
) => {
  const find = (nodes: TreeListNode[]): TreeListNode[] | undefined => {
    if (nodes.some((node) => node.id === id)) return nodes;
    for (const node of nodes) {
      const found = find((node.children ?? []) as TreeListNode[]);
      if (found) return found;
    }
  };
  for (const section of sections) {
    const siblings = find(section.nodes)?.filter((node) => !node.disabled);
    if (!siblings) continue;
    const index = siblings.findIndex((node) => node.id === id);
    const source = siblings[index];
    const movingIndexes = siblings.flatMap((node, index) => (selectedIds.includes(node.id) ? [index] : []));
    let edge = index;
    if (selectedIds.includes(id) && movingIndexes.length)
      edge = direction === -1 ? Math.min(...movingIndexes) : Math.max(...movingIndexes);
    const target = siblings[edge + direction];
    if (!source?.canDrag || !target?.canDrop) return;
    return { source: id, target: target.id, position: direction === -1 ? ("before" as const) : ("after" as const) };
  }
};
