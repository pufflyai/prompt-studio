import { expect, test } from "bun:test";
import { calculateStatusBarLayout, projectStatusBarDrop } from "./status-bar-layout";

const widgets = [
  { id: "drag", slot: "leading" },
  { id: "first", slot: "center" },
  { id: "second", slot: "center" },
  { id: "right", slot: "trailing" },
] as const;
const geometry = { width: 500, gap: 1, widths: { drag: 70, first: 50, second: 80, right: 40 } };

test("a center placeholder is between its neighbors and the whole group is centered", () => {
  const items = projectStatusBarDrop(widgets, "drag", { slot: "center", id: "first", edge: "after" })!;
  const layout = calculateStatusBarLayout(items, geometry);
  expect(layout.offsets).toEqual({ first: 149, drag: 200, second: 271, right: 460 });
});

test("an empty alignment uses its final position and a full bar leaves room for the placeholder", () => {
  const items = projectStatusBarDrop(widgets, "right", { slot: "trailing" })!;
  const narrow = calculateStatusBarLayout(items, { ...geometry, width: 100 });
  expect(narrow).toEqual({ width: 243, offsets: { drag: 0, first: 71, second: 122, right: 203 } });
  const emptyCenter = projectStatusBarDrop([{ id: "drag", slot: "leading" }], "drag", { slot: "center" })!;
  expect(calculateStatusBarLayout(emptyCenter, geometry).offsets.drag).toBe(215);
  expect(projectStatusBarDrop(widgets, "drag", { slot: "center", id: "missing", edge: "before" })).toBeUndefined();
});

test("the original drop position keeps the same widget order", () => {
  expect(projectStatusBarDrop(widgets, "first", { slot: "center", id: "first" })).toEqual(widgets);
});
