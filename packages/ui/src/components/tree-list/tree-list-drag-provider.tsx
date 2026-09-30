import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { createContext, type ReactNode } from "react";
import type { TreeListSection } from "./tree-list.types";
import { createTreeListDropHandler, treeListCollisionDetection } from "./tree-list-drag-handling";
import { type TreeListMovePolicy, verticalTreeDrag } from "./tree-list-reorder";

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
  const collisionDetection = treeListCollisionDetection(sections, canMove);
  const handleDragEnd = createTreeListDropHandler({ sections, canMove, onReorderSections, onReorderNodes });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={handleDragEnd}
      {...verticalTreeDrag}
    >
      <SharedTreeListDragContext.Provider value>{children}</SharedTreeListDragContext.Provider>
    </DndContext>
  );
};
