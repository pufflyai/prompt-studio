import type { CollisionDetection } from "@dnd-kit/core";

/** The pointer can approach an insertion anywhere in its layout, including over a live view. */
export const panelDropCollision: CollisionDetection = (args) => {
  const pointer = args.pointerCoordinates;
  if (!pointer) return [];
  return args.droppableContainers
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
      const distance = Math.hypot(
        Math.max(rect.left - pointer.x, 0, pointer.x - rect.right),
        Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom),
      );
      return [{ id: container.id, data: { droppableContainer: container, value: distance } }];
    })
    .sort((a, b) => a.data.value - b.data.value);
};
