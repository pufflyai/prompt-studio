import type { TreeListSection } from "./tree-list.types";
import {
  canDropOnTreeListTarget,
  findNodeLocation,
  fromGapDragId,
  fromSectionDragId,
  isGapDragId,
  isSectionDragId,
  type TreeListMovePolicy,
  toGapDragId,
  toSectionDragId,
} from "./tree-list-reorder";

export type TreeListDropEdge = "before" | "after";

// Where a dragged item lands: next to a row, or before, after ("behind") or inside a section.
export type TreeListDropTarget =
  | { kind: "node"; id: string; edge: TreeListDropEdge }
  | { kind: "section"; id: string; edge: TreeListDropEdge | "inside"; nextSectionId?: string };

export type TreeListDropResult =
  | { kind: "section"; nextSectionIds: string[] }
  | {
      kind: "node";
      orders: Record<string, string[]>;
      // A row dropped behind a group with no bare run after it starts a new bare run there.
      looseSection?: { id: string; afterSectionId: string; nextSectionIds: string[] };
    };

// The pointer's half of the hovered item picks the edge. A section's gap means "behind it"; a row dropped on a
// section's own area (its header or empty state) joins it.
export const resolveDropTarget = (
  activeId: string,
  overId: string,
  pointerAbove: boolean,
  nextSectionId?: string,
): TreeListDropTarget | null => {
  if (activeId === overId) return null;
  const edge = pointerAbove ? "before" : "after";
  if (isGapDragId(overId)) return { kind: "section", id: fromGapDragId(overId), edge: "after", nextSectionId };
  if (isSectionDragId(overId))
    return { kind: "section", id: fromSectionDragId(overId), edge: isSectionDragId(activeId) ? edge : "inside" };
  if (isSectionDragId(activeId)) return null;
  return { kind: "node", id: overId, edge };
};

const dropSectionOn = (
  sections: TreeListSection[],
  activeId: string,
  target: TreeListDropTarget,
  canMove?: TreeListMovePolicy,
): TreeListDropResult | null => {
  const activeSectionId = fromSectionDragId(activeId);
  if (target.kind !== "section" || target.edge === "inside" || target.id === activeSectionId) return null;
  if (!canDropOnTreeListTarget(sections, activeId, toSectionDragId(target.id), canMove)) return null;
  const ids = sections.map((section) => section.id);
  const next = ids.filter((id) => id !== activeSectionId);
  next.splice(next.indexOf(target.id) + (target.edge === "after" ? 1 : 0), 0, activeSectionId);
  return next.every((id, index) => id === ids[index]) ? null : { kind: "section", nextSectionIds: next };
};

// Resolves the section and index a row lands at, or undefined when it needs a new bare run behind a group.
const rowDestination = (
  sections: TreeListSection[],
  activeId: string,
  target: TreeListDropTarget,
  canMove?: TreeListMovePolicy,
) => {
  if (target.kind === "node") {
    const location = findNodeLocation(sections, target.id);
    if (!location) return null;
    return { sectionId: location.section.id, index: location.index + (target.edge === "after" ? 1 : 0) };
  }
  const section = sections.find((candidate) => candidate.id === target.id);
  if (!section) return null;
  // Behind a bare run of rows is its own end.
  if (target.edge === "inside" || !section.label) return { sectionId: section.id, index: section.nodes.length };
  const next = sections.find((candidate) => candidate.id === target.nextSectionId);
  const joinsNext =
    next &&
    !next.label &&
    next.canReorder !== false &&
    canDropOnTreeListTarget(sections, activeId, toSectionDragId(next.id), canMove);
  return joinsNext ? { sectionId: next.id, index: 0 } : undefined;
};

export const computeDropResult = (
  sections: TreeListSection[],
  activeId: string,
  target: TreeListDropTarget,
  canMove?: TreeListMovePolicy,
  looseSectionId?: string,
): TreeListDropResult | null => {
  if (isSectionDragId(activeId)) return dropSectionOn(sections, activeId, target, canMove);
  const source = findNodeLocation(sections, activeId);
  if (!source || source.node.canReorder === false) return null;
  const overId = target.kind === "node" ? target.id : toGapDragId(target.id);
  if (!canDropOnTreeListTarget(sections, activeId, overId, canMove)) return null;
  const destination = rowDestination(sections, activeId, target, canMove);
  if (destination === null) return null;

  const sourceIds = source.section.nodes.map((node) => node.id).filter((id) => id !== activeId);
  if (!destination) {
    if (!looseSectionId || target.kind !== "section") return null;
    const nextSectionIds = sections.map((section) => section.id);
    nextSectionIds.splice(nextSectionIds.indexOf(target.id) + 1, 0, looseSectionId);
    return {
      kind: "node",
      orders: { [source.section.id]: sourceIds, [looseSectionId]: [activeId] },
      looseSection: { id: looseSectionId, afterSectionId: target.id, nextSectionIds },
    };
  }

  if (destination.sectionId === source.section.id) {
    const index = destination.index - (source.index < destination.index ? 1 : 0);
    if (index === source.index) return null;
    sourceIds.splice(index, 0, activeId);
    return { kind: "node", orders: { [source.section.id]: sourceIds } };
  }
  const destinationIds =
    sections.find((section) => section.id === destination.sectionId)?.nodes.map((node) => node.id) ?? [];
  destinationIds.splice(destination.index, 0, activeId);
  return { kind: "node", orders: { [source.section.id]: sourceIds, [destination.sectionId]: destinationIds } };
};
