import { type CollisionDetection, pointerWithin } from "@dnd-kit/core";

/** Tabs keep their hit area while an insertion preview shifts their header. */
export const tabHeaderDropCollisions = (args: Parameters<CollisionDetection>[0]) => {
  const pointer = args.pointerCoordinates;
  if (!pointer) return [];
  const host = document
    .elementsFromPoint(pointer.x, pointer.y)
    .map((element) => element.closest("[data-workbench-panel]"))
    .find((panel) => panel && !panel.closest("[inert]"));
  const owner = host?.getAttribute("data-workbench-panel");
  const tabs = args.droppableContainers.filter((container) => {
    const node = container.node.current;
    return (
      (container.data.current?.widgetId || container.data.current?.headerBand) &&
      (!owner || container.data.current.region === owner) &&
      container.id !== args.active.id &&
      node?.getClientRects().length &&
      !node.closest("[inert]")
    );
  });
  const rects = new Map(args.droppableRects);
  for (const tab of tabs) {
    if (tab.data.current?.region === "side") continue;
    const node = tab.node.current!;
    const sideSlot = node
      .closest('[data-workbench-panel-drop-frame="side"]')
      ?.querySelector('[data-workbench-edge-drop="side"][data-workbench-edge-position="left"]')
      ?.getBoundingClientRect();
    const bottomSlot = node
      .closest('[data-workbench-panel-drop-frame="secondary"]')
      ?.querySelector('[data-workbench-edge-drop="secondary"][data-workbench-edge-position="top"]')
      ?.getBoundingClientRect();
    const rect = rects.get(tab.id);
    if (!rect) continue;
    const x = sideSlot?.width ?? 0;
    const y = bottomSlot?.height ?? 0;
    rects.set(tab.id, {
      ...rect,
      left: rect.left - x,
      top: rect.top - y,
      width: rect.width + x,
      height: rect.height + y,
    });
  }
  return pointerWithin({ ...args, droppableContainers: tabs, droppableRects: rects }).sort(
    (a, b) =>
      Number(Boolean(b.data?.droppableContainer.data.current?.widgetId)) -
      Number(Boolean(a.data?.droppableContainer.data.current?.widgetId)),
  );
};

export const tabEdgeDropCollisions = (args: Parameters<CollisionDetection>[0]) => {
  const pointer = args.pointerCoordinates;
  if (!pointer) return [];
  return args.droppableContainers
    .filter((container) => container.data.current?.panelPosition)
    .flatMap((container) => {
      const { region, panelPosition: edge } = container.data.current!;
      const node = container.node.current;
      const frame = node?.closest(`[data-workbench-panel-drop-frame="${region}"]`);
      if (!node || !frame) return [];
      const rect = frame.getBoundingClientRect();
      // Undo only the temporary Side slot's horizontal shift. An open Side
      // stays excluded, and Bottom still starts below navigation.
      const sideSlot =
        region === "secondary"
          ? node
              .closest('[data-workbench-panel-drop-frame="side"]')
              ?.querySelector('[data-workbench-edge-drop="side"]')
              ?.getBoundingClientRect()
          : undefined;
      const horizontal = {
        left: Math.min(rect.left, sideSlot?.left ?? rect.left),
        right: Math.max(rect.right, sideSlot?.right ?? rect.right),
      };
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
