import { describe, expect, test } from "bun:test";
import { resolveCategoricalColor } from "./categorical-color-cell";
import type { DataTableCategoricalColor } from "./types";

const categories: DataTableCategoricalColor[] = [
  { value: "On track", color: { light: "lightgreen", dark: "darkgreen" } },
  { value: "At risk", color: { light: "orange", dark: "darkorange" } },
  { value: "Blocked", color: { light: "pink", dark: "darkred" } },
];

describe("data table categorical color", () => {
  test("resolves the color for a matching category", () => {
    expect(resolveCategoricalColor("At risk", categories)).toEqual({ light: "orange", dark: "darkorange" });
  });

  test("does not color an unmatched value", () => {
    expect(resolveCategoricalColor("Unknown", categories)).toBeNull();
  });

  test("matches category values without coercing their type", () => {
    const numericCategories: DataTableCategoricalColor[] = [
      { value: 1, color: { light: "lightblue", dark: "darkblue" } },
    ];

    expect(resolveCategoricalColor(1, numericCategories)).toEqual({ light: "lightblue", dark: "darkblue" });
    expect(resolveCategoricalColor("1", numericCategories)).toBeNull();
  });
});
