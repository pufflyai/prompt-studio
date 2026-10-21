import type { CollisionDetection, UniqueIdentifier } from "@dnd-kit/core";

interface Point {
  x: number;
  y: number;
}
interface PanelDropTarget {
  id: UniqueIdentifier;
  rect: { left: number; right: number; top: number; bottom: number };
}

export const resolvePanelDropTarget = (pointer: Point, origin: Point, targets: PanelDropTarget[]) => {
  let closest: UniqueIdentifier | undefined;
  // The grab point competes with destinations, leaving a generous way to keep the current placement.
  let distance = Math.hypot(pointer.x - origin.x, pointer.y - origin.y);
  for (const { id, rect } of targets) {
    const candidate = Math.hypot(
      Math.max(rect.left - pointer.x, 0, pointer.x - rect.right),
      Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom),
    );
    if (candidate < distance) {
      closest = id;
      distance = candidate;
    }
  }
  return closest;
};

/** The pointer can approach an insertion anywhere in its layout, including over a live view. */
export const panelDropCollision = (args: Parameters<CollisionDetection>[0], origin: Point | undefined) => {
  const pointer = args.pointerCoordinates;
  if (!pointer || !origin) return [];
  const targets = args.droppableContainers
    .filter((container) => container.data.current?.panelRegion === args.active.data.current?.panelRegion)
    .flatMap((container) => {
      const frame = container.node.current
        ?.closest('[data-workbench-panel-drop-frame="activity"]')
        ?.getBoundingClientRect();
      const rect = args.droppableRects.get(container.id);
      if (
        !rect ||
        !frame ||
        pointer.x < frame.left ||
        pointer.x > frame.right ||
        pointer.y < frame.top ||
        pointer.y > frame.bottom
      )
        return [];
      return [{ id: container.id, rect }];
    });
  const id = resolvePanelDropTarget(pointer, origin, targets);
  return id === undefined ? [] : [{ id }];
};
