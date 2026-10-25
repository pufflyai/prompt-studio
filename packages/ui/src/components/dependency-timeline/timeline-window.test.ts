import { expect, test } from "bun:test";
import { edgeIntersectsWindow, graphWindow, intersectsWindow, visibleGraphRows } from "./timeline-window";

test("the visible graph window follows pan and zoom in canvas coordinates", () => {
  const bounds = graphWindow({ left: 200, top: 400, width: 600, height: 300, zoom: 2 });
  expect(intersectsWindow({ x: 120, y: 220, width: 240, height: 68 }, bounds)).toBe(true);
  expect(intersectsWindow({ x: 2000, y: 2000, width: 240, height: 68 }, bounds)).toBe(false);
});

test("large plans mount nearby cards and retain selection, focus, and the dragged card", () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({ id: String(index) }));
  const positions = new Map(rows.map((row, index) => [row.id, { x: 80, y: index * 120, width: 240, height: 68 }]));
  const bounds = graphWindow({ left: 0, top: 0, width: 800, height: 600, zoom: 1 });
  const visible = visibleGraphRows(rows, positions, bounds, new Set(["300", "500", "700"]));
  expect(visible.length).toBeLessThan(15);
  expect(visible.map(({ id }) => id)).toEqual(expect.arrayContaining(["0", "1", "300", "500", "700"]));
  expect(visible.some(({ id }) => id === "999")).toBe(false);
  const later = graphWindow({ left: 0, top: 119000, width: 800, height: 600, zoom: 1 });
  expect(visibleGraphRows(rows, positions, later, new Set()).map(({ id }) => id)).toContain("995");
});

test("dependency edges remain visible when they cross the window between offscreen cards", () => {
  const bounds = { x: 100, y: 100, width: 400, height: 400 };
  const above = { x: 200, y: 0, width: 100, height: 40 };
  const below = { x: 200, y: 600, width: 100, height: 40 };
  const beside = { x: 600, y: 200, width: 100, height: 40 };
  expect(edgeIntersectsWindow(above, below, bounds)).toBe(true);
  expect(edgeIntersectsWindow(below, above, bounds)).toBe(true);
  expect(edgeIntersectsWindow(beside, { ...beside, y: 400 }, bounds)).toBe(false);
});
