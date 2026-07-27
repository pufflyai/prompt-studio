import { describe, expect, it } from "bun:test";

import { flattenKanbanRendererListItems, getKanbanRendererListIndentation } from "./kanban-renderer-list";

describe("getKanbanRendererListIndentation", () => {
  it("does not indent top-level rows", () => {
    expect(getKanbanRendererListIndentation(0)).toBeUndefined();
  });

  it("uses compact depth indentation", () => {
    expect(getKanbanRendererListIndentation(1)).toBe("12px");
    expect(getKanbanRendererListIndentation(2)).toBe("24px");
  });
});

describe("flattenKanbanRendererListItems", () => {
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
    const flattened = flattenKanbanRendererListItems(currentItems, {});

    expect(flattened.map((row) => row.id)).toEqual(["group::done", "task-1"]);
  });

  it("keeps explicitly collapsed groups closed", () => {
    const flattened = flattenKanbanRendererListItems(currentItems, { "group::done": false });

    expect(flattened.map((row) => row.id)).toEqual(["group::done"]);
  });

  it("uses the current list item metadata when flattening expanded groups", () => {
    const flattened = flattenKanbanRendererListItems(currentItems, { "group::done": true });

    expect(flattened[0]?.item.countColorPalette).toBe("red");
    expect(flattened.map((row) => row.depth)).toEqual([0, 1]);
  });

  it("keeps an empty group distinct from a resource row", () => {
    const [row] = flattenKanbanRendererListItems(
      [{ id: "group::done", title: "Done", countBadge: 0, isGroup: true, children: [] }],
      {},
    );

    expect(row).toMatchObject({ isGroup: true, canExpand: false });
  });
});
