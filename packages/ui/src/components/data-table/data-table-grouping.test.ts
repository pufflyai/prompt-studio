import { describe, expect, test } from "bun:test";
import type { KanbanRendererRow } from "../kanban-renderer/types";
import { pageGroupedRows } from "./data-table-grouping";

const row = (id: string): KanbanRendererRow => ({ id, title: id, attributes: {} });
const groups = [
  { key: "review", label: "In review", rows: [row("a"), row("b")] },
  { key: "todo", label: "Todo", rows: [row("c")] },
  { key: "backlog", label: "Backlog", rows: [row("d"), row("e")] },
];
const read = (result: ReturnType<typeof pageGroupedRows>) =>
  result.entries.map((entry) => (entry.kind === "group" ? `#${entry.group.key}` : entry.row.id));

describe("grouped table pages", () => {
  test("pages count rows and a continuing group repeats its group row", () => {
    expect(read(pageGroupedRows(groups, new Set(), 0, 3))).toEqual(["#review", "a", "b", "#todo", "c"]);
    expect(read(pageGroupedRows(groups, new Set(), 1, 3))).toEqual(["#backlog", "d", "e"]);
    expect(read(pageGroupedRows(groups, new Set(), 0, 4))).toEqual([
      "#review",
      "a",
      "b",
      "#todo",
      "c",
      "#backlog",
      "d",
    ]);
    expect(read(pageGroupedRows(groups, new Set(), 1, 4))).toEqual(["#backlog", "e"]);
  });

  test("a collapsed group keeps its group row and gives its rows to the pages", () => {
    const result = pageGroupedRows(groups, new Set(["review"]), 0, 3);

    expect(read(result)).toEqual(["#review", "#todo", "c", "#backlog", "d", "e"]);
    expect(result.pageCount).toBe(1);
    expect(read(pageGroupedRows(groups, new Set(["backlog"]), 0, 3))).toEqual([
      "#review",
      "a",
      "b",
      "#todo",
      "c",
      "#backlog",
    ]);
  });
});
