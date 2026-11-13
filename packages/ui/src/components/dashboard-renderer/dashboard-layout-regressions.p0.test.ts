import { expect, test } from "bun:test";
import { previewWidgetMove, projectWidgets, resizeWidget } from "./dashboard-layout";
import type { GridPlacement } from "./dashboard-types";

const widget = (id: string, layout: GridPlacement) => ({
  id,
  title: id,
  kind: "metric" as const,
  source: "sales",
  layout,
});

test("horizontal swaps reject cross-row overlap in free placement", () => {
  const widgets = [
    widget("a", { x: 0, y: 0, w: 4, h: 3 }),
    widget("b", { x: 4, y: 0, w: 4, h: 8 }),
    widget("c", { x: 0, y: 3, w: 4, h: 8 }),
  ];
  const preview = previewWidgetMove(widgets, "a", { x: 4, y: 0, w: 4, h: 3 }, 12, "free");
  expect(preview.type).toBe("none");
  expect(preview.widgets).toEqual(widgets);
});

test("inserting at a bottom gap retains staggered offsets above the insertion", () => {
  const widgets = [
    widget("a", { x: 0, y: 0, w: 4, h: 8 }),
    widget("b", { x: 4, y: 0, w: 4, h: 3 }),
    widget("c", { x: 4, y: 3, w: 4, h: 8 }),
    widget("d", { x: 8, y: 0, w: 4, h: 3 }),
  ];
  const preview = previewWidgetMove(widgets, "d", { x: 8, y: 10, w: 4, h: 3 }, 12, "free", {
    position: { x: 10, y: 10.8 },
    gapRatio: 1 / 3,
  });
  expect(preview.type).toBe("row");
  for (const original of widgets.slice(0, 3))
    expect(preview.widgets.find(({ id }) => id === original.id)?.layout).toEqual(original.layout);
  expect(preview.widgets.find(({ id }) => id === "d")?.layout.y).toBe(11);
});

test("height-only tablet corner resizing preserves an odd saved width", () => {
  const widgets = [widget("a", { x: 0, y: 0, w: 3, h: 3 })];
  const width = projectWidgets(widgets, 6)[0].layout.w;
  expect(width).toBe(2);
  expect(resizeWidget(widgets, "a", { w: width, h: 5 }, 6, "free", "se")[0].layout).toEqual({ x: 0, y: 0, w: 3, h: 5 });
  expect(resizeWidget(widgets, "a", { w: width + 1, h: 5 }, 6, "free", "se")[0].layout.w).toBe(5);
});

test("inserting beyond the last widget retains the selected end gap in free placement", () => {
  const widgets = [widget("a", { x: 0, y: 0, w: 4, h: 3 })];
  const preview = previewWidgetMove(widgets, "a", { x: 0, y: 2, w: 4, h: 3 }, 12, "free", {
    position: { x: 2, y: 2.8 },
    gapRatio: 1 / 3,
  });
  expect(preview.widgets[0].layout.y).toBe(3);
});
