import { describe, expect, test } from "bun:test";
import { benchmarkCoverageErrors, benchmarkExecutionErrors } from "./coverage";

const file = "packages/example/src/open.p3.bench.ts";
const suite = { id: "example", files: [file] };

describe("benchmark suite coverage", () => {
  test("requires every maintained benchmark to belong to a suite", () => {
    const untracked = "packages/example/src/save.p3.bench.ts";
    expect(benchmarkCoverageErrors([file, untracked], [suite])).toEqual([
      `${untracked} is not tracked. Add it to a suite in packages/benchmarks/src/suites.ts.`,
    ]);
  });

  test("reports the suite and missing file after a benchmark is renamed", () => {
    expect(benchmarkCoverageErrors([], [suite])).toEqual([`Suite example names a missing benchmark: ${file}`]);
  });

  test("keeps diagnostics outside suites and requires the benchmark naming rule", () => {
    const diagnostic = "packages/example/src/load.diagnostic.ts";
    const legacy = "packages/example/src/open.p3.perf.ts";
    expect(benchmarkCoverageErrors([file, diagnostic], [suite])).toEqual([]);
    expect(benchmarkCoverageErrors([file, legacy], [suite])).toEqual([
      `${legacy} must use .p3.bench.ts for a benchmark or .diagnostic.ts for an investigation.`,
    ]);
    expect(benchmarkCoverageErrors([diagnostic], [{ id: "example", files: [diagnostic] }])).toEqual([
      `Suite example names a non-benchmark: ${diagnostic}`,
    ]);
  });

  test("rejects duplicate ownership instead of measuring one file twice", () => {
    expect(benchmarkCoverageErrors([file], [suite, { id: "other", files: [file] }])).toEqual([
      `${file} is tracked by multiple suites: example, other`,
    ]);
  });

  test("requires an explicit P3 priority", () => {
    const unprioritized = "packages/example/src/open.bench.ts";
    expect(benchmarkCoverageErrors([unprioritized], [])).toEqual([
      `${unprioritized} must declare the P3 priority as .p3.bench.ts.`,
    ]);
  });
});

test("rejects a registered benchmark that its suite does not execute", () => {
  const context = { root: "/checkout", cacheDir: "/cache", sha: "example", platform: "linux-x64" };
  const registered = { ...suite, label: "Example", sample: () => [{ command: ["bun", "other.ts"] }] };
  expect(benchmarkExecutionErrors(context, [registered])).toEqual([
    `Suite example does not execute its registered benchmark: ${file}`,
  ]);
  expect(
    benchmarkExecutionErrors(context, [
      { ...registered, sample: () => [{ cwd: "packages/example", command: ["bun", "src/open.p3.bench.ts"] }] },
    ]),
  ).toEqual([]);
});
