import { describe, expect, test } from "bun:test";
import { filterRowsByView } from "../collection-view/collection-view-filter";
import {
  buildDataTableRendererAttributes,
  buildDataTableRendererRows,
  getSelectedOriginalRows,
  reorderDataTableColumns,
  resolveDataTableColumnOrder,
  resolveDataTableRowId,
  resolveDataTableToolbarStorageKey,
  resolveInitialPageSize,
  resolveSelectionActions,
  shouldHighlightActiveRow,
} from "./data-table-state";
import type { DataTableSelectionAction, RowData } from "./types";

describe("data table state helpers", () => {
  test("resolves row ids from row.id or caller override", () => {
    expect(resolveDataTableRowId({ id: "row-1" }, 0)).toBe("row-1");
    expect(resolveDataTableRowId({ key: "custom" }, 2, (row) => String(row.key))).toBe("custom");
    expect(resolveDataTableRowId({ key: "fallback" }, 3)).toBe("3");
  });

  test("uses configured initial page size when valid", () => {
    expect(resolveInitialPageSize({ initialPageSize: 20 })).toBe(20);
    expect(resolveInitialPageSize({ initialPageSize: 0 })).toBe(30);
  });

  test("maps selected table rows back to original row objects", () => {
    const selectedRows = [{ original: { id: "row-1" } }, { original: { id: "row-2" } }];

    expect(getSelectedOriginalRows(selectedRows)).toEqual([{ id: "row-1" }, { id: "row-2" }]);
  });

  test("preserves CSV download as a selection action", () => {
    const calls: string[][] = [];
    const actions = resolveSelectionActions({
      onCSVDownload: (ids) => calls.push(ids),
      getRowId: (row) => String(row.id),
    });

    actions[0]?.onSelect([{ id: "row-1" }, { id: "row-2" }]);

    expect(actions[0]?.label).toBe("Download CSV");
    expect(calls).toEqual([["row-1", "row-2"]]);
  });

  test("keeps caller-provided selection actions", () => {
    const action: DataTableSelectionAction = {
      label: "Archive",
      onSelect: (_rows: RowData[]) => {},
    };

    expect(resolveSelectionActions({ selectionActions: [action] })).toEqual([action]);
  });

  test("builds renderer rows and attributes for table filtering", () => {
    const rows: RowData[] = [
      { id: "row-1", Status: "Paid", Amount: 10, Approved: true },
      { id: "row-2", Status: "Pending", Amount: 15, Approved: false },
    ];
    const columnKeys = ["Status", "Amount", "Approved"];

    const attributes = buildDataTableRendererAttributes(rows, columnKeys, {
      compactHeaders: { Status: "State" },
      columnTypes: { Approved: "string" },
      groupableColumns: ["Status"],
    });
    const rendererRows = buildDataTableRendererRows(rows, columnKeys);

    expect(
      attributes.map((attribute) => [attribute.id, attribute.label, attribute.type.kind, attribute.groupable]),
    ).toEqual([
      ["Status", "State", "string", true],
      ["Amount", "Amount", "number", false],
      ["Approved", "Approved", "string", false],
    ]);
    expect(rendererRows[0]).toMatchObject({
      id: "row-1",
      title: "Paid",
      attributes: { Status: "Paid", Amount: 10, Approved: "true" },
      sourceRow: rows[0],
    });
  });

  test("uses total changes as the attribute value of diff cells", () => {
    const rows: RowData[] = [
      { id: "row-1", Diff: { additions: 12, deletions: 3 } },
      { id: "row-2", Diff: "Not supported" },
    ];
    const renderers = { Diff: { type: "diff" as const } };

    const attributes = buildDataTableRendererAttributes(rows, ["Diff"], { columnRenderers: renderers });
    const rendererRows = buildDataTableRendererRows(rows, ["Diff"], undefined, renderers);

    expect(rendererRows.map((row) => row.attributes.Diff)).toEqual([15, "Not supported"]);
    const rule = { attributeId: "Diff", condition: "is" as const, value: "Not supported" };
    expect(filterRowsByView(rendererRows, { conjunction: "and", rules: [rule] }, attributes)).toHaveLength(1);
  });

  test("a declared column type and the date renderer decide how rules compare a column", () => {
    const rows: RowData[] = [{ id: "row-1", Score: "70", Updated: "2026-10-01" }];

    const attributes = buildDataTableRendererAttributes(rows, ["Score", "Updated"], {
      columnTypes: { Score: "number" },
      columnRenderers: { Updated: { type: "date" } },
    });

    expect(attributes.map((attribute) => attribute.type.kind)).toEqual(["number", "date"]);
  });

  test("keeps column order aligned with available columns", () => {
    expect(resolveDataTableColumnOrder(["Invoice", "Vendor", "Amount"], ["Amount", "Missing", "Invoice"])).toEqual([
      "Amount",
      "Invoice",
      "Vendor",
    ]);
  });

  test("reorders columns by dragged and target ids", () => {
    expect(reorderDataTableColumns(["Invoice", "Vendor", "Amount"], "Invoice", "Amount")).toEqual([
      "Vendor",
      "Amount",
      "Invoice",
    ]);
    expect(reorderDataTableColumns(["Invoice", "Vendor", "Amount"], "Missing", "Amount")).toEqual([
      "Invoice",
      "Vendor",
      "Amount",
    ]);
  });

  test("resolves a stable toolbar storage key", () => {
    expect(resolveDataTableToolbarStorageKey({ columnKeys: ["Status", "Amount"] })).toBe("data-table:Status|Amount");
    expect(resolveDataTableToolbarStorageKey({ toolbarStorageKey: "invoices", columnKeys: ["Status"] })).toBe(
      "invoices",
    );
  });

  test("requires the activation flag before highlighting active rows", () => {
    expect(shouldHighlightActiveRow({ rowId: "row-1", activeRowId: "row-1" })).toBe(false);
    expect(shouldHighlightActiveRow({ rowId: "row-1", activeRowId: "row-1", enableRowActivation: true })).toBe(true);
  });
});
