import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { createContext, type ReactNode, useRef } from "react";
import type { TreeListNode, TreeListSection } from "./tree-list.types";
import { createTreeListDropHandler, treeListCollisionDetection } from "./tree-list-drag-handling";
import { findNodeLocation, type TreeListMovePolicy, verticalTreeDrag } from "./tree-list-reorder";

export const SharedTreeListDragContext = createContext(false);

interface TreeListDragProviderProps {
  sections: TreeListSection[];
  canMove?: TreeListMovePolicy;
  onReorderSections?: (nextSectionIds: string[], sourceSectionId: string, destinationSectionId: string) => void;
  onReorderNodes?: (sectionId: string, nextNodeIds: string[]) => void;
  /** A host may accept navigation rows outside the tree, for example on a tab strip. */
  onDropOutside?: (node: TreeListNode, point: { x: number; y: number }) => boolean;
  children: ReactNode;
}

export const TreeListDragProvider = (props: TreeListDragProviderProps) => {
  const { sections, canMove, onReorderSections, onReorderNodes, children } = props;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const collisionDetection = treeListCollisionDetection(sections, canMove);
  const point = useRef<{ x: number; y: number } | null>(null);
  const handleDragEnd = createTreeListDropHandler({ sections, canMove, onReorderSections, onReorderNodes });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        point.current = args.pointerCoordinates;
        return collisionDetection(args);
      }}
      onDragEnd={(event) => {
        const node = findNodeLocation(sections, String(event.active.id))?.node;
        if (node && point.current && props.onDropOutside?.(node, point.current)) return;
        handleDragEnd(event);
      }}
      {...(props.onDropOutside ? {} : verticalTreeDrag)}
    >
      <SharedTreeListDragContext.Provider value>{children}</SharedTreeListDragContext.Provider>
    </DndContext>
  );
};
