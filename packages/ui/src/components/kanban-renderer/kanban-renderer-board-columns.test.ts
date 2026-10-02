import { describe, expect, test } from "bun:test";
import { withTitleField } from "../collection-view/collection-view-fields";
import { narrowKanbanRows } from "./kanban-renderer-board-columns";
import { DEFAULT_KANBAN_RENDERER_SETTINGS, type KanbanRendererRow } from "./types";

const rows: KanbanRendererRow[] = [
  { id: "1", title: "Chat tables", attributes: { id: "PS-12" } },
  { id: "2", title: "Docs", attributes: { id: "PS-30" } },
  { id: "3", title: "Chat scroll", attributes: { id: "PS-31" } },
];
const narrow = (search: string, viewMode: "board" | "list") =>
  narrowKanbanRows({
    rows,
    filter: { conjunction: "and", rules: [] },
    fields: withTitleField([]),
    attributes: [],
    settings: { ...DEFAULT_KANBAN_RENDERER_SETTINGS, viewMode, columnGrouping: "none", displayProperties: [] },
    search,
  });

describe("narrowing board rows", () => {
  test("lists find rows by the short id they always show", () => {
    expect(narrow("PS-3", "list").visibleRows.map((row) => row.id)).toEqual(["2", "3"]);
    expect(narrow("PS-3", "board").visibleRows).toEqual([]);
  });

  test("a board without columns counts every row the filter keeps", () => {
    const { visibleRows, columnTotals } = narrow("chat", "board");
    expect(visibleRows).toHaveLength(2);
    expect([...columnTotals.values()]).toEqual([3]);
  });
});
