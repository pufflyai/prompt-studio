import { expect, test } from "bun:test";
import { dataTableCellText } from "./data-table-state";

test("search reads formatted labels rather than their sort values", () => {
  expect(dataTableCellText({ display: "Completed", sortValue: 7 })).toEqual(["Completed"]);
});
test("search reads rendered relative dates and diff counts", () => {
  expect(dataTableCellText("2026-10-02T12:00:00Z", { type: "date" }, new Date("2026-10-03T12:00:00Z"))).toEqual([
    "yesterday",
  ]);
  expect(dataTableCellText({ additions: 128, deletions: 14 }, { type: "diff" })).toEqual(["+128", "-14"]);
});
