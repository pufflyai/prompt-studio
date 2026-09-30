import type { TreeListSection } from "./tree-list.types";
import type { TreeListDropTarget } from "./tree-list-drop";
import { findNodeLocation, toGapDragId, toSectionDragId } from "./tree-list-reorder";

export interface TreeListDropIndicator {
  // Drag id of the row, section, or section gap that draws the line.
  lineId: string;
  edge: "before" | "after" | "middle";
  // A labeled section the item drops into; it is highlighted so "into" reads differently from "behind".
  groupId?: string;
}

const groupOf = (section: TreeListSection | undefined) => (section?.label ? section.id : undefined);

// Only targets inside this tree's sections draw here; a shared drag context lets each tree draw its own part.
export const treeListDropIndicator = (
  sections: TreeListSection[],
  target: TreeListDropTarget | null,
): TreeListDropIndicator | null => {
  if (!target) return null;
  if (target.kind === "node") {
    const location = findNodeLocation(sections, target.id);
    return location ? { lineId: target.id, edge: target.edge, groupId: groupOf(location.section) } : null;
  }
  const section = sections.find((candidate) => candidate.id === target.id);
  if (!section) return null;
  if (target.edge === "inside") {
    const last = section.nodes.at(-1);
    return { lineId: last ? last.id : toSectionDragId(section.id), edge: "after", groupId: groupOf(section) };
  }
  if (target.edge === "after") return { lineId: toGapDragId(section.id), edge: "middle" };
  return { lineId: toSectionDragId(section.id), edge: "before" };
};
