import type { TreeListSection } from "./tree-list.types";
import { fromSectionDragId, isSectionDragId } from "./tree-list-reorder";

export interface TreeListDropIndicator {
  id: string;
  edge: "before" | "after";
}

const nodeIndex = (sections: TreeListSection[], nodeId: string) => {
  for (const section of sections) {
    const index = section.nodes.findIndex((node) => node.id === nodeId);
    if (index >= 0) return { sectionId: section.id, index };
  }
  return undefined;
};

// Mirrors where computeReorderResult places the item: moving down lands after the target, moving up or in from
// another section lands before it, and dropping on a section appends to its end.
export const treeListDropIndicator = (
  sections: TreeListSection[],
  activeId: string,
  overId: string,
): TreeListDropIndicator | null => {
  if (activeId === overId) return null;
  if (isSectionDragId(activeId)) {
    const ids = sections.map((section) => section.id);
    const from = ids.indexOf(fromSectionDragId(activeId));
    const to = ids.indexOf(fromSectionDragId(overId));
    return { id: overId, edge: from >= 0 && from < to ? "after" : "before" };
  }
  if (isSectionDragId(overId)) return { id: overId, edge: "after" };
  const source = nodeIndex(sections, activeId);
  const target = nodeIndex(sections, overId);
  const movesDown = source && target && source.sectionId === target.sectionId && source.index < target.index;
  return { id: overId, edge: movesDown ? "after" : "before" };
};
