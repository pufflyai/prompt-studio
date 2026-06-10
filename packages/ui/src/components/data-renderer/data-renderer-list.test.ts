import { describe, expect, it } from "bun:test";

import { flattenDataRendererListItems, getDataRendererListIndentation } from "./data-renderer-list";

describe("getDataRendererListIndentation", () => {
  it("does not indent top-level rows", () => {
    expect(getDataRendererListIndentation(0)).toBeUndefined();
  });

  it("uses compact depth indentation", () => {
    expect(getDataRendererListIndentation(1)).toBe("12px");
    expect(getDataRendererListIndentation(2)).toBe("24px");
  });
});

describe("flattenDataRendererListItems", () => {
  const currentItems = [
    {
      id: "group::done",
      title: "Done",
      countBadge: 1,
      countColorPalette: "red",
      children: [{ id: "task-1", title: "Write docs" }],
    },
  ];

  it("opens groups by default when no explicit state exists", () => {
    const flattened = flattenDataRendererListItems(currentItems, {});

    expect(flattened.map((row) => row.id)).toEqual(["group::done", "task-1"]);
  });

  it("keeps explicitly collapsed groups closed", () => {
    const flattened = flattenDataRendererListItems(currentItems, { "group::done": false });

    expect(flattened.map((row) => row.id)).toEqual(["group::done"]);
  });

  it("uses the current list item metadata when flattening expanded groups", () => {
    const flattened = flattenDataRendererListItems(currentItems, { "group::done": true });

    expect(flattened[0]?.item.countColorPalette).toBe("red");
    expect(flattened.map((row) => row.depth)).toEqual([0, 1]);
  });
});
