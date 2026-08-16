import { describe, expect, test } from "bun:test";
import {
  addMarkdownTableColumn,
  addMarkdownTableRow,
  type MarkdownTableValue,
  removeMarkdownTableColumn,
  removeMarkdownTableRow,
  updateMarkdownTableCell,
  updateMarkdownTableColumn,
} from "./markdown-table";

const table: MarkdownTableValue = {
  columns: [
    { id: "column-1", label: "Name", alignment: "left" },
    { id: "column-2", label: "Name", alignment: null },
  ],
  rows: [
    { id: "row-1", cells: { "column-1": "Alice", "column-2": "Admin" } },
    { id: "row-2", cells: { "column-1": "Bob", "column-2": "Editor" } },
  ],
};

describe("Markdown table state", () => {
  test("keeps cell identity when duplicate headers are renamed", () => {
    const renamed = updateMarkdownTableColumn(table, "column-2", {
      label: "Role",
      alignment: "right",
    });

    expect(renamed.columns[1]).toEqual({ id: "column-2", label: "Role", alignment: "right" });
    expect(renamed.rows[0]?.cells).toEqual({ "column-1": "Alice", "column-2": "Admin" });
  });

  test("adds and removes rows and columns without changing source order", () => {
    const withColumn = addMarkdownTableColumn(table, {
      id: "column-3",
      label: "Notes",
      alignment: "center",
    });
    const withRow = addMarkdownTableRow(withColumn, {
      id: "row-3",
      cells: { "column-1": "Carol", "column-2": "Viewer", "column-3": "New" },
    });
    const edited = updateMarkdownTableCell(withRow, "row-1", "column-3", "**Owner**");
    const withoutColumn = removeMarkdownTableColumn(edited, "column-1");
    const withoutRow = removeMarkdownTableRow(withoutColumn, "row-2");

    expect(withoutRow.columns.map((column) => column.id)).toEqual(["column-2", "column-3"]);
    expect(withoutRow.rows.map((row) => row.id)).toEqual(["row-1", "row-3"]);
    expect(withoutRow.rows[0]?.cells).toEqual({ "column-2": "Admin", "column-3": "**Owner**" });
  });

  test("does not remove the last column", () => {
    const singleColumn: MarkdownTableValue = {
      columns: [{ id: "only", label: "", alignment: null }],
      rows: [{ id: "row", cells: { only: "value" } }],
    };

    expect(removeMarkdownTableColumn(singleColumn, "only")).toEqual(singleColumn);
  });
});
