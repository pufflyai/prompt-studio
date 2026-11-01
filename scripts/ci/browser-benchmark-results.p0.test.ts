import { expect, test } from "bun:test";
import { type BrowserBenchmarkReport, browserBenchmarkResults } from "./browser-benchmark-results";

const expected = [{ file: "clients/desktop/src/e2e/launch.bench.ts", name: "cold start" }];
const report = (): BrowserBenchmarkReport => ({
  config: { rootDir: "/repo/clients/desktop/src/e2e" },
  suites: [
    {
      specs: [
        { file: "launch.bench.ts", title: "warm launch", tests: [{ results: [{ status: "passed" }] }] },
        { file: "launch.bench.ts", title: "cold start", tests: [{ results: [{ status: "failed" }] }] },
        { file: "renderer.bench.ts", title: "renderer", tests: [{ results: [{ status: "passed" }] }] },
      ],
    },
  ],
});

test("one ordered execution retains quarantined failures and keeps stable failures blocking", () => {
  const input = report();
  const result = browserBenchmarkResults(input, expected, "/repo");
  expect(result.executed).toBe(3);
  expect(result.quarantined).toEqual({ executed: 1, failures: 1 });
  expect(result.stableFailures).toEqual([]);
  expect(result.quarantineReport.suites[0]!.specs!.map((entry) => entry.title)).toEqual(["cold start"]);
  expect(input.suites[0]!.specs!.map((entry) => entry.title)).toEqual(["warm launch", "cold start", "renderer"]);
  input.suites[0]!.specs![2]!.tests[0]!.results[0]!.status = "timedOut";
  expect(browserBenchmarkResults(input, expected, "/repo").stableFailures).toHaveLength(1);
});

test("missing, skipped or repeated quarantine attempts cannot clear the gate", () => {
  for (const status of ["skipped", "interrupted"]) {
    const input = report();
    input.suites[0]!.specs![1]!.tests[0]!.results[0]!.status = status;
    expect(() => browserBenchmarkResults(input, expected, "/repo")).toThrow();
  }
  const repeated = report();
  repeated.suites[0]!.specs![1]!.tests[0]!.results.push({ status: "passed" });
  expect(() => browserBenchmarkResults(repeated, expected, "/repo")).toThrow("execute once");
  const missing = report();
  missing.suites[0]!.specs!.splice(1, 1);
  expect(() => browserBenchmarkResults(missing, expected, "/repo")).toThrow("exactly once");
  const setup = report();
  setup.errors = ["browser unavailable"];
  expect(() => browserBenchmarkResults(setup, expected, "/repo")).toThrow("setup failed");
});

test("duplicate stable cases and unexpected stable skips are rejected too", () => {
  const duplicate = report();
  duplicate.suites[0]!.specs!.push(duplicate.suites[0]!.specs![0]!);
  expect(() => browserBenchmarkResults(duplicate, expected, "/repo")).toThrow("repeated");
  const skipped = report();
  skipped.suites[0]!.specs![0]!.tests[0]!.results[0]!.status = "skipped";
  expect(() => browserBenchmarkResults(skipped, expected, "/repo")).toThrow("unexpectedly skipped");
});
