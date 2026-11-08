import { expect, test } from "bun:test";
import { subnavBenchmarkResults } from "./subnav-benchmark-results";
import type { SubnavObservedRequest } from "./subnav-request-outcomes";

const measurements = () =>
  Array.from({ length: 30 }, () =>
    (["first", "repeat"] as const).flatMap((visit) => [
      {
        destination: "ticket" as const,
        visit,
        structureMs: 300,
        dataMs: 1200,
        editorMs: 1100,
        requests: [] as SubnavObservedRequest[],
      },
      {
        destination: "sessions" as const,
        visit,
        structureMs: 300,
        dataMs: 500,
        requests: [] as SubnavObservedRequest[],
      },
    ]),
  ).flat();

test("navigation reports all fourteen contracts and keeps a repeated-ticket structure miss isolated", () => {
  const samples = measurements();
  samples[2]!.structureMs = 376.5;
  const result = subnavBenchmarkResults(samples, 30);
  expect(result.specs).toHaveLength(14);
  expect(
    result.specs.filter((spec) => spec.tests[0]!.results[0]!.status === "failed").map((spec) => spec.title),
  ).toEqual(["ticket/repeat structure"]);
  expect(result.budgetErrors).toEqual(["ticket/repeat structure measured 376.5 ms, not below its 375 ms budget"]);
});

test("request failures remain red in their exact destination and visit contract", () => {
  const samples = measurements();
  const failed: SubnavObservedRequest = {
    path: "/tree",
    url: "https://benchmark.test/tree",
    method: "POST",
    startedMs: 100,
    completedMs: 150,
    durationMs: 50,
    failure: "net::ERR_ABORTED",
  };
  samples[15]!.requests.push(failed);
  const result = subnavBenchmarkResults(samples, 30);
  expect(
    result.specs.filter((spec) => spec.tests[0]!.results[0]!.status === "failed").map((spec) => spec.title),
  ).toEqual(["sessions/repeat requests"]);
  expect(result.requestErrors).toHaveLength(1);
  expect(samples[15]!.requests).toEqual([failed]);
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

test("navigation budget failures retain the exact performance-only classification evidence", () => {
  const samples = measurements();
  samples[0]!.dataMs = 1560.4;
  samples[0]!.editorMs = 1451;
  const { specs } = subnavBenchmarkResults(samples, 30);
  for (const spec of specs) {
    const result = spec.tests[0]!;
    expect((result as { annotations?: unknown[] }).annotations).toEqual(
      result.results[0]!.errors.map(({ message }) => ({ type: "performance-budget-failure", description: message })),
    );
  }
});
