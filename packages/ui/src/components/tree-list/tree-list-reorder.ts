import type { TreeListSection } from "./tree-list.types";

const SECTION_PREFIX = "section:";

export const toSectionDragId = (sectionId: string) => `${SECTION_PREFIX}${sectionId}`;
export const isSectionDragId = (id: string) => id.startsWith(SECTION_PREFIX);
export const fromSectionDragId = (id: string) => id.slice(SECTION_PREFIX.length);

const arrayMoveInPlace = <T>(items: T[], from: number, to: number) => {
  const next = items.slice();
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
};

export type ReorderResult =
  | { kind: "section"; nextSectionIds: string[] }
  | { kind: "node"; sectionId: string; nextNodeIds: string[] };

export const computeReorderResult = (
  sections: TreeListSection[],
  activeId: string,
  overId: string,
): ReorderResult | null => {
  if (activeId === overId) return null;

  if (isSectionDragId(activeId) && isSectionDragId(overId)) {
    const orderedIds = sections.map((section) => section.id);
    const oldIndex = orderedIds.indexOf(fromSectionDragId(activeId));
    const newIndex = orderedIds.indexOf(fromSectionDragId(overId));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return null;
    return { kind: "section", nextSectionIds: arrayMoveInPlace(orderedIds, oldIndex, newIndex) };
  }

  for (const section of sections) {
    const nodeIds = section.nodes.map((node) => node.id);
    const oldIndex = nodeIds.indexOf(activeId);
    const newIndex = nodeIds.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) continue;
    if (oldIndex === newIndex) return null;
    return {
      kind: "node",
      sectionId: section.id,
      nextNodeIds: arrayMoveInPlace(nodeIds, oldIndex, newIndex),
    };
  }

  return null;
};
