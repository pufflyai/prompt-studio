import { expect, test } from "bun:test";
import { resolveDataTableComparableValue, resolveDataTableFieldKind } from "../extension-kernel/data-table-values";
import { dataTableRendererColumnSchema, dataTableRendererSettingsSchema } from "./data-table-renderer";

test("native tables accept inline chart columns and optional shared domains", () => {
  for (const type of ["sparkline", "bar-chart"] as const) {
    const column = { id: "history", renderer: { type, domain: [0, 100] as [number, number], unit: "ms" } };
    expect(dataTableRendererColumnSchema.parse(column)).toEqual(column);
  }
});

test("row heights remain optional for existing saved views and preserve tall rows", () => {
  const settings = {
    grouping: "none",
    rowNumbers: true,
    wrapRows: false,
    showStats: false,
    hiddenColumns: [],
    columnOrder: [],
  };
  expect(dataTableRendererSettingsSchema.parse(settings)).toEqual(settings);
  expect(dataTableRendererSettingsSchema.parse({ ...settings, rowHeight: "tall" })).toEqual({
    ...settings,
    rowHeight: "tall",
  });
});

test("chart columns sort and filter by their latest measured value, including zero", () => {
  for (const type of ["sparkline", "bar-chart"] as const) {
    expect(resolveDataTableComparableValue({ values: [12, null, 8, null] }, { type })).toBe(8);
    expect(resolveDataTableComparableValue({ values: [12, 0] }, { type })).toBe(0);
    expect(resolveDataTableComparableValue({ values: [null, null] }, { type })).toBeUndefined();
    expect(resolveDataTableFieldKind([], { renderer: { type } })).toBe("number");
  }
});
