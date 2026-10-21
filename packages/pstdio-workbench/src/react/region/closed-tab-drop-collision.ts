import type { CollisionDetection } from "@dnd-kit/core";

export const closedTabDropCollisions = (args: Parameters<CollisionDetection>[0], sideOpen: boolean) => {
  const pointer = args.pointerCoordinates;
  if (!pointer) return [];
  return args.droppableContainers
    .filter((container) => container.data.current?.closed)
    .flatMap((container) => {
      const { region, edge } = container.data.current!;
      const node = container.node.current;
      const frame = node?.closest(`[data-workbench-panel-drop-frame="${region}"]`);
      if (!node || !frame) return [];
      const rect = frame.getBoundingClientRect();
      // Side previews narrow Bottom's frame. Keep its horizontal hit extent at
      // the outer boundary, while its vertical extent still starts below navigation.
      const sideFrame =
        region === "secondary" && !sideOpen ? node.closest('[data-workbench-panel-drop-frame="side"]') : undefined;
      const horizontal = sideFrame?.getBoundingClientRect() ?? rect;
      if (
        pointer.x < horizontal.left ||
        pointer.x > horizontal.right ||
        pointer.y < rect.top ||
        pointer.y > rect.bottom
      )
        return [];
      const distances = {
        left: pointer.x - horizontal.left,
        right: horizontal.right - pointer.x,
        top: pointer.y - rect.top,
        bottom: rect.bottom - pointer.y,
      };
      const vertical = edge === "left" || edge === "right";
      const hit = node.getBoundingClientRect();
      const distance = distances[edge as keyof typeof distances];
      if (distance > (vertical ? hit.width : hit.height)) return [];
      return [{ id: container.id, data: { droppableContainer: container, value: distance } }];
    })
    .sort((a, b) => a.data.value - b.data.value)
    .slice(0, 1);
};
