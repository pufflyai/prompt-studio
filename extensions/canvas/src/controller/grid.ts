import type { CanvasDefinition } from "../canvas-model";
import type { Layout } from "../layout";

export const arrangeGrid = (
  canvas: CanvasDefinition,
  layout: Layout,
  sizes: Map<string, { height: number }>,
  automatic: Set<string>,
  moved: Set<string>,
) => {
  const width = Math.max(...canvas.items.map((item) => item.width)) + 80;
  let y = 0;
  for (let start = 0; start < canvas.items.length; start += 4) {
    const row = canvas.items.slice(start, start + 4);
    for (const [column, item] of row.entries()) {
      if (!automatic.has(item.id)) continue;
      layout.positions[item.id] = { x: column * width, y };
      moved.add(item.id);
    }
    y += Math.max(...row.map((item) => sizes.get(item.id)?.height ?? item.height + 36)) + 80;
  }
};

export const canvasBounds = (
  canvas: CanvasDefinition,
  layout: Layout,
  sizes: Map<string, { width: number; height: number }>,
  id?: string,
) => {
  const entries = canvas.items
    .filter((item) => !id || item.id === id)
    .map((item) => ({
      ...layout.positions[item.id],
      ...(sizes.get(item.id) ?? { width: item.width, height: item.height + 36 }),
    }));
  const x = Math.min(...entries.map((entry) => entry.x));
  const y = Math.min(...entries.map((entry) => entry.y));
  return {
    x,
    y,
    width: Math.max(...entries.map((entry) => entry.x + entry.width)) - x,
    height: Math.max(...entries.map((entry) => entry.y + entry.height)) - y,
  };
};

export const defaultGridItems = (canvas: CanvasDefinition, layout: Layout) =>
  new Set(
    canvas.layout === "grid"
      ? canvas.items
          .filter((item) => {
            const position = layout.positions[item.id];
            return position.x === item.position.x && position.y === item.position.y;
          })
          .map((item) => item.id)
      : [],
  );
