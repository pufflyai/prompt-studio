import { type CollisionDetection, closestCenter, type DragEndEvent, type Over, pointerWithin } from "@dnd-kit/core";
import type { TreeListSection } from "./tree-list.types";
import { computeDropResult, resolveDropTarget } from "./tree-list-drop";
import {
  canDropOnTreeListTarget,
  fromSectionDragId,
  isGapDragId,
  isSectionDragId,
  type TreeListMovePolicy,
} from "./tree-list-reorder";

// Rows win over section gaps, and gaps over the section boxes that contain them.
const targetRank = (id: string) => {
  if (isSectionDragId(id)) return 2;
  if (isGapDragId(id)) return 1;
  return 0;
};

export const treeListCollisionDetection =
  (sections: TreeListSection[], canMove?: TreeListMovePolicy): CollisionDetection =>
  (args) => {
    const activeId = String(args.active.id);
    const valid = (collision: { id: string | number }) =>
      canDropOnTreeListTarget(sections, activeId, String(collision.id), canMove);
    // The pointer's x is pinned to the dragged item's column, so only vertical movement picks a target.
    const pointerCoordinates = args.pointerCoordinates && {
      x: args.collisionRect.left + args.collisionRect.width / 2,
      y: args.pointerCoordinates.y,
    };
    const within = pointerCoordinates ? pointerWithin({ ...args, pointerCoordinates }).filter(valid) : [];
    if (within.length === 0) return closestCenter(args).filter(valid);
    return within.sort((left, right) => targetRank(String(left.id)) - targetRank(String(right.id)));
  };

// The live pointer is where the drag started plus how far it moved.
export const dragPointerY = (activatorEvent: Event | null, deltaY: number) =>
  (activatorEvent instanceof MouseEvent ? activatorEvent.clientY : 0) + deltaY;

export const dropTargetFor = (activeId: string, over: Over | null, pointerY: number) =>
  over
    ? resolveDropTarget(
        activeId,
        String(over.id),
        pointerY < over.rect.top + over.rect.height / 2,
        over.data.current?.nextSectionId as string | undefined,
      )
    : null;

const createLooseSectionId = () => `tree-list-loose:${crypto.randomUUID()}`;

interface TreeListDropHandlerInput {
  sections: TreeListSection[];
  canMove?: TreeListMovePolicy;
  onReorderSections?: (nextSectionIds: string[], sourceSectionId: string, destinationSectionId: string) => void;
  onReorderNodes?: (sectionId: string, nextNodeIds: string[]) => void;
}

export const createTreeListDropHandler = (input: TreeListDropHandlerInput) => (event: DragEndEvent) => {
  const activeId = String(event.active.id);
  const target = dropTargetFor(activeId, event.over, dragPointerY(event.activatorEvent, event.delta.y));
  if (!target) return;
  const result = computeDropResult(input.sections, activeId, target, input.canMove, createLooseSectionId());
  if (!result) return;
  if (result.kind === "section") {
    input.onReorderSections?.(result.nextSectionIds, fromSectionDragId(activeId), target.id);
    return;
  }
  // A new bare run takes the slot of the group it sits behind.
  const loose = result.looseSection;
  if (loose) input.onReorderSections?.(loose.nextSectionIds, loose.id, loose.afterSectionId);
  for (const [sectionId, nextNodeIds] of Object.entries(result.orders)) input.onReorderNodes?.(sectionId, nextNodeIds);
};
