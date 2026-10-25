import { describe, expect, test } from "bun:test";
import { fromSectionDragId, isSectionDragId, toSectionDragId, verticalTreeDrag } from "./tree-list-reorder";

describe("section drag id helpers", () => {
  test("round-trips through toSectionDragId / fromSectionDragId", () => {
    const id = toSectionDragId("alpha");
    expect(isSectionDragId(id)).toBe(true);
    expect(fromSectionDragId(id)).toBe("alpha");
  });
});

test("tree drags follow the pointer vertically only", () => {
  const [lockToVerticalAxis] = verticalTreeDrag.modifiers;
  const transform = { x: 48, y: 12, scaleX: 1, scaleY: 1 };
  expect(lockToVerticalAxis!({ transform } as Parameters<NonNullable<typeof lockToVerticalAxis>>[0])).toEqual({
    ...transform,
    x: 0,
  });
  expect(verticalTreeDrag.autoScroll.threshold.x).toBe(0);
});
