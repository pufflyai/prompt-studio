import { expect, test } from "bun:test";
import { assess, summarize } from "./evidence";

test("every sample must finish strictly below the ceiling with complete correctness and bounded work", () => {
  const sample = {
    durationMs: 1_249,
    correct: true,
    scanned: 100,
    materialized: 100,
    returned: 100,
    fullOwnerLoads: 0,
    durable: true,
  };
  expect(assess(sample).passed).toBe(true);
  for (const change of [
    { durationMs: 1_250 },
    { correct: false },
    { materialized: 10_000 },
    { fullOwnerLoads: 1 },
    { durable: false },
    { scanned: null },
  ])
    expect(assess({ ...sample, ...change }).passed).toBe(false);
  const summary = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 1_500]);
  expect(summary).toEqual({ count: 10, p50: 5, p95: 1_500, max: 1_500 });
});
