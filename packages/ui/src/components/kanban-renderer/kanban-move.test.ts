import { expect, test } from "bun:test";
import { applyKanbanMove, buildKanbanMove } from "./kanban-move";

const rows = [
  { id: "a", title: "A", attributes: { status: "todo", priority: "high" } },
  { id: "b", title: "B", attributes: { status: "done", priority: "low" } },
  { id: "c", title: "C", attributes: { status: "todo", priority: "high" } },
];

test("one manual move retains destination intent and its order target", () => {
  const move = buildKanbanMove({
    rowId: "a",
    columnGrouping: "status",
    rowGrouping: "priority",
    targetColumnId: "todo",
    targetGroupKey: "low",
    beforeRowId: "c",
    sorts: [],
  });
  expect(move).toEqual({ rowId: "a", attributes: { status: "todo", priority: "low" }, order: { beforeRowId: "c" } });
});

test("sorted moves leave manual ordering alone", () => {
  const move = buildKanbanMove({
    rowId: "a",
    columnGrouping: "status",
    rowGrouping: "none",
    targetColumnId: "done",
    beforeRowId: "b",
    sorts: [{ attributeId: "title", direction: "asc" }],
  });
  expect(move).toEqual({ rowId: "a", attributes: { status: "done" } });
  expect(applyKanbanMove(rows, move).map(({ id }) => id)).toEqual(["a", "b", "c"]);
});

test("preview changes only the moved row and preserves hidden rows in global order", () => {
  const next = applyKanbanMove(rows, { rowId: "c", attributes: { status: "done" }, order: { beforeRowId: "b" } });
  expect(next.map(({ id }) => id)).toEqual(["a", "c", "b"]);
  expect(next[0]).toBe(rows[0]);
  expect(next[2]).toBe(rows[1]);
  expect(next[1].attributes.status).toBe("done");
});
