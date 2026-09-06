import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { createContext, type ReactNode } from "react";
import type { TreeListSection } from "./tree-list.types";
import type { TreeListMovePolicy } from "./tree-list-reorder";
import { canDropOnTreeListTarget, computeReorderResult, fromSectionDragId } from "./tree-list-reorder";

export const SharedTreeListDragContext = createContext(false);

interface TreeListDragProviderProps {
  sections: TreeListSection[];
  canMove?: TreeListMovePolicy;
  onReorderSections?: (nextSectionIds: string[], sourceSectionId: string, destinationSectionId: string) => void;
  onReorderNodes?: (sectionId: string, nextNodeIds: string[]) => void;
  children: ReactNode;
}

export const TreeListDragProvider = (props: TreeListDragProviderProps) => {
  const { sections, canMove, onReorderSections, onReorderNodes, children } = props;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const collisionDetection: CollisionDetection = (input) =>
    closestCenter(input).filter((collision) =>
      canDropOnTreeListTarget(sections, String(input.active.id), String(collision.id), canMove),
    );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) return;
    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    const result = computeReorderResult(sections, activeId, overId, canMove);
    if (!result) return;
    if (result.kind === "section") {
      onReorderSections?.(result.nextSectionIds, fromSectionDragId(activeId), fromSectionDragId(overId));
      return;
    }
    for (const [sectionId, nextNodeIds] of Object.entries(result.orders)) {
      onReorderNodes?.(sectionId, nextNodeIds);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragEnd={handleDragEnd}>
      <SharedTreeListDragContext.Provider value>{children}</SharedTreeListDragContext.Provider>
    </DndContext>
  );
};
