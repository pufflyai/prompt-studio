import { expect, test } from "bun:test";
import { contract, scenarios } from "./contract";
import { coverage } from "./coverage";

test("coverage cannot replace missing cold, constrained or background samples with native warm results", () => {
  const complete = scenarios("rich").map((row) => ({ ...row, passed: true }));
  expect(coverage("rich", complete).passed).toBe(true);
  expect(
    coverage(
      "small",
      scenarios("small").map((row) => ({ ...row, passed: true })),
    ).passed,
  ).toBe(true);
  const missing = complete.filter((row) => row.profile !== "combined");
  expect(coverage("rich", missing).passed).toBe(false);
  expect(coverage("rich", [...complete, complete[0]]).passed).toBe(false);
  expect(
    coverage(
      "rich",
      complete.map((row, index) => ({ ...row, passed: index !== 0 })),
    ).passed,
  ).toBe(false);
  expect(new Set(complete.map((row) => row.sample)).size).toBe(contract.samples);
});
