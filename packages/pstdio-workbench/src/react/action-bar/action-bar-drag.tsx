import { Box } from "@chakra-ui/react";
import {
  type CollisionDetection,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { DropIndicator, Portal } from "@pstdio/ui";
import { type ReactNode, useRef, useState } from "react";
import type { ActionBarDropEdge } from "./action-bar-order";

interface ActionBarDrop {
  id: string;
  edge: ActionBarDropEdge;
}

export const useActionBarDrag = (
  horizontal: boolean,
  move: (id: string, targetId: string, edge: ActionBarDropEdge) => void,
) => {
  const viewport = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const [activeId, setActiveId] = useState<string>();
  const [drop, setDrop] = useState<ActionBarDrop>();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
  );
  const collisionDetection: CollisionDetection = (args) => {
    pointer.current = args.pointerCoordinates;
    const at = pointer.current;
    const bounds = viewport.current?.getBoundingClientRect();
    if (!at || !bounds || at.x < bounds.left || at.x > bounds.right || at.y < bounds.top || at.y > bounds.bottom)
      return [];
    return pointerWithin(args);
  };
  const resolveDrop = (event: DragOverEvent) => {
    const { over, active } = event;
    const at = pointer.current;
    if (!over || over.id === active.id || !at) return;
    const before = horizontal
      ? at.x < over.rect.left + over.rect.width / 2
      : at.y < over.rect.top + over.rect.height / 2;
    return { id: String(over.id), edge: before ? "before" : "after" } satisfies ActionBarDrop;
  };
  const updateDrop = (event: DragOverEvent) => setDrop(resolveDrop(event));
  const finish = () => {
    pointer.current = null;
    setActiveId(undefined);
    setDrop(undefined);
  };
  return {
    viewport,
    activeId,
    drop,
    context: {
      sensors,
      collisionDetection,
      onDragStart: (event: DragStartEvent) => setActiveId(String(event.active.id)),
      onDragOver: updateDrop,
      onDragMove: updateDrop,
      onDragCancel: finish,
      onDragEnd: (event: DragOverEvent) => {
        const target = resolveDrop(event);
        finish();
        if (target) move(String(event.active.id), target.id, target.edge);
      },
    },
  };
};

interface SortableActionBarItemProps {
  id: string;
  reorderable: boolean;
  horizontal: boolean;
  dropEdge?: ActionBarDropEdge;
  children: ReactNode;
}

export const SortableActionBarItem = (props: SortableActionBarItemProps) => {
  const { id, reorderable, horizontal, dropEdge, children } = props;
  const drag = useDraggable({ id, disabled: !reorderable });
  const target = useDroppable({ id, disabled: !reorderable });
  const edges = horizontal ? { before: "left", after: "right" } : { before: "top", after: "bottom" };
  return (
    <Box
      ref={(node: HTMLDivElement | null) => {
        drag.setNodeRef(node);
        target.setNodeRef(node);
      }}
      data-action-bar-item={id}
      data-dragging={drag.isDragging || undefined}
      opacity={drag.isDragging ? 0.5 : undefined}
      position="relative"
      onPointerDownCapture={(event) => {
        // Menu triggers can prevent the mouse event that follows pointerdown.
        if (event.pointerType !== "touch" && event.currentTarget.contains(event.target as Node))
          drag.listeners?.onPointerDown?.(event);
      }}
      onTouchStartCapture={(event) => {
        if (event.currentTarget.contains(event.target as Node)) drag.listeners?.onTouchStart?.(event);
      }}
    >
      {children}
      {dropEdge ? (
        <DropIndicator orientation={horizontal ? "vertical" : "horizontal"} {...{ [edges[dropEdge]]: 0 }} />
      ) : null}
    </Box>
  );
};

export const ActionBarDragPreview = (props: { label?: string }) => (
  <Portal>
    {props.label ? <Box position="fixed" inset="0" zIndex="overlay" layerStyle="panelDragging" /> : null}
    <Box asChild pointerEvents="none">
      <DragOverlay dropAnimation={null}>
        {props.label ? (
          <Box layerStyle="floatingBar" textStyle="label/XS/medium" w="max-content">
            {props.label}
          </Box>
        ) : null}
      </DragOverlay>
    </Box>
  </Portal>
);
