import { describe, expect, test } from "bun:test";
import { findBudgetFailures } from "./benchmark-budget";

const metric = (value: number) => ({ name: "cold-start", unit: "ms" as const, value, budget: 8_000 });

describe("benchmark budgets", () => {
  test("accept measurements below their budget", () => {
    expect(findBudgetFailures([metric(7_999)])).toEqual([]);
  });

  test("reject a measurement at or over its budget", () => {
    expect(findBudgetFailures([metric(8_000)])).toEqual(["cold-start measured 8000 ms, not below its 8000 ms budget"]);
  });

  test("reject missing measurements instead of treating them as zero", () => {
    expect(findBudgetFailures([metric(Number.NaN), metric(Number.POSITIVE_INFINITY)])).toEqual([
      "cold-start was not measured",
      "cold-start was not measured",
    ]);
    expect(findBudgetFailures([])).toEqual(["No measurements were recorded"]);
  });
});
