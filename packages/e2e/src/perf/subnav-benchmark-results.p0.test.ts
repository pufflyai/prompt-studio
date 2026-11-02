import { expect, test } from "bun:test";
import { subnavBenchmarkResults } from "./subnav-benchmark-results";

const measurements = () =>
  Array.from({ length: 30 }, () =>
    (["first", "repeat"] as const).flatMap((visit) => [
      { destination: "ticket" as const, visit, structureMs: 300, dataMs: 1200, editorMs: 1100 },
      { destination: "sessions" as const, visit, structureMs: 300, dataMs: 500 },
    ]),
  ).flat();

test("navigation reports all ten contracts and keeps a repeated-ticket structure miss isolated", () => {
  const samples = measurements();
  samples[2]!.structureMs = 376.5;
  const result = subnavBenchmarkResults(samples, 30);
  expect(result.specs).toHaveLength(10);
  expect(
    result.specs.filter((spec) => spec.tests[0]!.results[0]!.status === "failed").map((spec) => spec.title),
  ).toEqual(["ticket/repeat structure"]);
  expect(result.budgetErrors).toEqual(["ticket/repeat structure measured 376.5 ms, not below its 375 ms budget"]);
});

test("missing, repeated and reordered navigation measurements cannot become quarantine evidence", () => {
  const samples = measurements();
  expect(() => subnavBenchmarkResults(samples.slice(1), 30)).toThrow("every ordered measurement exactly once");
  expect(() => subnavBenchmarkResults([...samples, ...samples], 30)).toThrow("every ordered measurement exactly once");
  [samples[0], samples[1]] = [samples[1]!, samples[0]!];
  expect(() => subnavBenchmarkResults(samples, 30)).toThrow("every ordered measurement exactly once");
});

test("invalid timing evidence blocks instead of becoming a quarantined budget miss", () => {
  const samples = measurements();
  samples[2]!.structureMs = Number.NaN;
  expect(() => subnavBenchmarkResults(samples, 30)).toThrow("Invalid navigation measurement");
});
