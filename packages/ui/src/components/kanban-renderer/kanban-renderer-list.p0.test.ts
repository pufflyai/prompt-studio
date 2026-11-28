import { describe, expect, it } from "bun:test";

import { flattenKanbanRendererListItems } from "./kanban-renderer-list";

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

  it("places continuation after the last loaded child of expanded groups with more rows", () => {
    const items = [
      { ...currentItems[0], isGroup: true, remainingRows: 0 },
      {
        id: "group::in-progress",
        title: "In progress",
        isGroup: true,
        remainingRows: 5,
        children: [{ id: "task-2", title: "Review changes" }],
      },
      { id: "group::todo", title: "Todo", isGroup: true, remainingRows: 10 },
      { id: "group::blocked", title: "Blocked", isGroup: true, remainingRows: 3 },
    ];
    const rows = flattenKanbanRendererListItems(items, { "group::blocked": false }, 0, true);
    expect(rows.map((row) => [row.item.id, Boolean(row.pageBoundary), row.depth])).toEqual([
      ["group::done", false, 0],
      ["task-1", false, 1],
      ["group::in-progress", false, 0],
      ["task-2", false, 1],
      ["group::in-progress", true, 1],
      ["group::todo", false, 0],
      ["group::todo", true, 1],
      ["group::blocked", false, 0],
    ]);
  });
});
