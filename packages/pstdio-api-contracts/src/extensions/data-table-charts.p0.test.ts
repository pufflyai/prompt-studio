import { expect, test } from "bun:test";
import { resolveDataTableComparableValue, resolveDataTableFieldKind } from "../extension-kernel/data-table-values";

test("chart columns sort and filter by their latest measured value, including zero", () => {
  for (const type of ["sparkline", "bar-chart"] as const) {
    expect(resolveDataTableComparableValue({ values: [12, null, 8, null] }, { type })).toBe(8);
    expect(resolveDataTableComparableValue({ values: [12, 0] }, { type })).toBe(0);
    expect(resolveDataTableComparableValue({ values: [null, null] }, { type })).toBeUndefined();
    expect(resolveDataTableFieldKind([], { renderer: { type } })).toBe("number");
  }
});
