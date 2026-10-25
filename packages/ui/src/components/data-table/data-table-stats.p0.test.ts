import { describe, expect, test } from "bun:test";
import { buildHistogramStat, buildTopValuesStat, countUniqueStatValues } from "./data-table-stats";
import type { RowData } from "./types";

describe("data table column stats", () => {
  test("counts distinct non-empty values using display sort values", () => {
    const rows: RowData[] = [
      { Status: "Paid" },
      { Status: { display: "Paid badge", sortValue: "Paid" } },
      { Status: "Pending" },
      { Status: "" },
      { Status: null },
      { Status: undefined },
    ];

    expect(countUniqueStatValues(rows, "Status")).toBe(2);
  });

  test("groups top values by frequency with deterministic ties and an Other group", () => {
    const rows: RowData[] = [
      { Region: "Europe" },
      { Region: "APAC" },
      { Region: "Europe" },
      { Region: "LATAM" },
      { Region: "APAC" },
      { Region: "North America" },
      { Region: "" },
    ];

    expect(buildTopValuesStat(rows, "Region", 2)).toEqual([
      { label: "APAC", count: 2, percentage: 33 },
      { label: "Europe", count: 2, percentage: 33 },
      { label: "Other", count: 2, percentage: 33 },
    ]);
  });

  test("builds equal-width numeric histogram bins and assigns the maximum to the final bin", () => {
    const rows: RowData[] = [
      { Amount: 0 },
      { Amount: 2 },
      { Amount: 4 },
      { Amount: 6 },
      { Amount: 8 },
      { Amount: 10 },
      { Amount: "not numeric" },
      { Amount: null },
    ];

    expect(buildHistogramStat(rows, "Amount", 5)).toEqual({
      min: 0,
      max: 10,
      bins: [
        { start: 0, end: 2, count: 1 },
        { start: 2, end: 4, count: 1 },
        { start: 4, end: 6, count: 1 },
        { start: 6, end: 8, count: 1 },
        { start: 8, end: 10, count: 2 },
      ],
    });
  });
});
