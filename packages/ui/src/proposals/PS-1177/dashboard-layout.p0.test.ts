import { describe, expect, test } from "bun:test";
import type { DashboardWidget } from "./dashboard-fixtures";
import { compactWidgets, dashboardColumns, moveWidget, projectWidgets, resizeWidget } from "./dashboard-layout";

const fixtures: DashboardWidget[] = [
  { id: "first", title: "First", kind: "metric", source: "users", layout: { x: 0, y: 0, w: 4, h: 3 } },
  { id: "second", title: "Second", kind: "metric", source: "users", layout: { x: 4, y: 0, w: 4, h: 3 } },
  { id: "chart", title: "Chart", kind: "line", source: "users", layout: { x: 0, y: 3, w: 6, h: 8 } },
];

describe("dashboard grid editing", () => {
  test("dragging onto a horizontal neighbor swaps places without pushing it into another row", () => {
    const result = moveWidget(fixtures, "first", { x: 4, y: 0, w: 4, h: 3 }, 12);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual(fixtures[1].layout);
    expect(result.find(({ id }) => id === "second")?.layout).toEqual(fixtures[0].layout);
    expect(result.find(({ id }) => id === "chart")?.layout).toEqual(fixtures[2].layout);
    expect(moveWidget(fixtures, "first", { x: 4, y: 0, w: 4, h: 3 }, 12)).toEqual(result);
    expect(fixtures[0].layout).toEqual({ x: 0, y: 0, w: 4, h: 3 });
  });

  test("overlapping a neighbor swaps it even before the dragged center reaches it", () => {
    const result = moveWidget(fixtures, "first", { x: 1, y: 0, w: 4, h: 3 }, 12);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual(fixtures[1].layout);
    expect(result.find(({ id }) => id === "second")?.layout).toEqual(fixtures[0].layout);
  });

  test("vertical neighbors exchange their positions", () => {
    const vertical = [fixtures[0], { ...fixtures[1], layout: { x: 0, y: 3, w: 4, h: 3 } }];
    const result = moveWidget(vertical, "first", vertical[1].layout, 12);
    expect(result.find(({ id }) => id === "second")?.layout).toEqual(vertical[0].layout);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual(vertical[1].layout);
    const taller = [vertical[0], { ...vertical[1], layout: { ...vertical[1].layout, h: 8 } }];
    const resized = moveWidget(taller, "first", vertical[1].layout, 12);
    expect(resized.find(({ id }) => id === "second")?.layout).toEqual({ x: 0, y: 0, w: 4, h: 8 });
    expect(resized.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 8, w: 4, h: 3 });
  });

  test("horizontal swaps preserve different widget sizes and the occupied row", () => {
    const sized = [
      { ...fixtures[0], layout: { x: 0, y: 0, w: 3, h: 3 } },
      { ...fixtures[1], layout: { x: 3, y: 0, w: 6, h: 3 } },
      { ...fixtures[0], id: "third", layout: { x: 9, y: 0, w: 3, h: 3 } },
    ];
    const result = moveWidget(sized, "first", { x: 3, y: 0, w: 3, h: 3 }, 12);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 6, y: 0, w: 3, h: 3 });
    expect(result.find(({ id }) => id === "second")?.layout).toEqual({ x: 0, y: 0, w: 6, h: 3 });
    expect(result.find(({ id }) => id === "third")?.layout).toEqual(sized[2].layout);
  });

  test("phone swaps exchange the two widgets instead of inserting between them", () => {
    const metrics = [fixtures[0], fixtures[1], { ...fixtures[0], id: "third", layout: { x: 8, y: 0, w: 4, h: 3 } }];
    const result = moveWidget(metrics, "first", { x: 0, y: 6, w: 1, h: 3 }, 1);
    expect(projectWidgets(result, 1).map(({ id }) => id)).toEqual(["third", "second", "first"]);
  });

  test("free placement keeps empty-space positions without moving other widgets", () => {
    const result = moveWidget(fixtures, "first", { x: 8, y: 4, w: 4, h: 3 }, 12, "free");
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 8, y: 4, w: 4, h: 3 });
    expect(result.find(({ id }) => id === "chart")?.layout).toEqual(fixtures[2].layout);
    expect(result.find(({ id }) => id === "second")?.layout).toEqual(fixtures[1].layout);
    expect(fixtures[0].layout).toEqual({ x: 0, y: 0, w: 4, h: 3 });
  });

  test("resizing spans grid columns and rows without overlapping the neighboring widget", () => {
    const result = resizeWidget(fixtures, "first", { w: 7, h: 5 }, 12);
    expect(result.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 0, w: 7, h: 5 });
    expect(result.find(({ id }) => id === "second")?.layout.y).toBe(5);
    expect(result.find(({ id }) => id === "chart")?.layout.y).toBe(8);
  });

  test("size and movement stay inside the grid and keep usable minimum dimensions", () => {
    const resized = resizeWidget(fixtures, "first", { w: 40, h: -2 }, 12);
    expect(resized.find(({ id }) => id === "first")?.layout).toEqual({ x: 0, y: 0, w: 12, h: 3 });
    const moved = moveWidget(fixtures, "second", { x: 40, y: -2, w: 4, h: 3 }, 12);
    expect(moved.find(({ id }) => id === "second")?.layout).toEqual({ x: 8, y: 0, w: 4, h: 3 });
  });

  test("narrow layouts stack cards without changing their saved desktop placement", () => {
    expect(dashboardColumns(380)).toBe(1);
    expect(dashboardColumns(760)).toBe(6);
    expect(dashboardColumns(1140)).toBe(12);
    const phone = projectWidgets(fixtures, 1);
    expect(phone.map(({ layout }) => layout)).toEqual([
      { x: 0, y: 0, w: 1, h: 3 },
      { x: 0, y: 3, w: 1, h: 3 },
      { x: 0, y: 6, w: 1, h: 8 },
    ]);
    expect(projectWidgets(fixtures, 12)).toEqual(fixtures);
  });

  test("phone resizing preserves desktop width and changes height", () => {
    const resized = resizeWidget(fixtures, "first", { w: 1, h: 6 }, 1);
    expect(resized.find(({ id }) => id === "first")?.layout.w).toBe(4);
    expect(projectWidgets(resized, 1).find(({ id }) => id === "first")?.layout.h).toBe(6);
  });

  test("the left resize handle keeps the opposite edge fixed and only changes width", () => {
    const resized = resizeWidget(fixtures, "second", { w: 6, h: 20 }, 12, "free", "w");
    expect(resized.find(({ id }) => id === "second")?.layout).toEqual({ x: 2, y: 0, w: 6, h: 3 });
    const bounded = resizeWidget(fixtures, "second", { w: 30, h: 3 }, 12, "free", "w");
    expect(bounded.find(({ id }) => id === "second")?.layout).toEqual({ x: 0, y: 0, w: 8, h: 3 });
  });

  test("right resizing stays anchored and inside the grid", () => {
    const resized = resizeWidget(fixtures, "second", { w: 12, h: 20 }, 12, "free", "e");
    expect(resized.find(({ id }) => id === "second")?.layout).toEqual({ x: 4, y: 0, w: 8, h: 3 });
  });

  test("bottom resizing preserves width while the bottom-left corner changes both dimensions", () => {
    const bottom = resizeWidget(fixtures, "second", { w: 12, h: 5 }, 12, "free", "s");
    expect(bottom.find(({ id }) => id === "second")?.layout).toEqual({ x: 4, y: 0, w: 4, h: 5 });
    const corner = resizeWidget(fixtures, "second", { w: 3, h: 5 }, 12, "free", "sw");
    expect(corner.find(({ id }) => id === "second")?.layout).toEqual({ x: 5, y: 0, w: 3, h: 5 });
  });

  test("picking up a widget on a phone keeps its position until it moves", () => {
    const origin = projectWidgets(fixtures, 1)[0].layout;
    expect(moveWidget(fixtures, "first", origin, 1)).toEqual(fixtures);
  });

  test("cards flow to the top by default after a drop into empty space", () => {
    const moved = moveWidget(fixtures, "first", { x: 8, y: 12, w: 4, h: 3 }, 12);
    expect(moved.find(({ id }) => id === "first")?.layout).toEqual({ x: 8, y: 0, w: 4, h: 3 });
  });

  test("vertical compaction closes holes left by removing a card", () => {
    const lower = { ...fixtures[0], id: "lower", layout: { x: 0, y: 12, w: 4, h: 3 } };
    expect(compactWidgets([lower])[0].layout.y).toBe(0);
    expect(compactWidgets([fixtures[0], lower])[1].layout.y).toBe(3);
  });

  test("horizontal mode closes gaps to the left while free mode preserves placement", () => {
    const spaced = [
      { ...fixtures[0], layout: { x: 4, y: 6, w: 3, h: 3 } },
      { ...fixtures[1], layout: { x: 8, y: 6, w: 3, h: 3 } },
    ];
    expect(compactWidgets(spaced, "horizontal").map(({ layout }) => [layout.x, layout.y])).toEqual([
      [0, 6],
      [3, 6],
    ]);
    expect(compactWidgets(spaced, "free")).toEqual(spaced);
    expect(spaced[0].layout).toEqual({ x: 4, y: 6, w: 3, h: 3 });
  });
});
