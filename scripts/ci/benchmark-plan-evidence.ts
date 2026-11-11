import { readFileSync } from "node:fs";
import { join } from "node:path";
import { browserBenchmarkResults } from "./browser-benchmark-results";
import type { PlannedRun, SourceIdentity } from "./test-plan";
import { matchesPlatform, quarantineRegistry } from "./test-quarantine";

// Reopen native reports after transport; lifecycle summaries alone cannot certify a workload.
export const benchmarkPlanEvidence = (directory: string, run: PlannedRun, source: SourceIdentity) => {
  const read = (file: string) => JSON.parse(readFileSync(join(directory, file), "utf8"));
  if (run.benchmarkSuite !== "subnav") {
    const file = `performance/${source.sha}-${run.target.platform}-${run.target.arch}.json`;
    const report = read(file);
    if (
      report.format !== 1 ||
      report.commit.sha !== source.sha ||
      report.platform !== `${run.target.platform}-${run.target.arch}` ||
      report.suites.length !== 1 ||
      report.suites[0].id !== run.benchmarkSuite ||
      !report.metrics.length ||
      !report.metrics.every(
        (metric: { suite: string; values: number[] }) =>
          metric.suite === run.benchmarkSuite &&
          metric.values.length === 1 &&
          metric.values.every((value) => Number.isFinite(value) && value >= 0),
      )
    )
      throw new Error("Invalid native benchmark measurements");
    return [file];
  }
  const files = ["performance/subnav/results.json", "performance/subnav/browser-report.json"];
  const measurements = read(files[0]!);
  const order = ["ticket/first", "sessions/first", "ticket/repeat", "sessions/repeat"];
  if (
    measurements.sourceCommit !== source.sha ||
    measurements.platform !== `${run.target.platform}/${run.target.arch}` ||
    measurements.samples.length !== 120 ||
    measurements.samples.some(
      (sample: { destination: string; visit: string }, index: number) =>
        `${sample.destination}/${sample.visit}` !== order[index % 4],
    )
  )
    throw new Error("Incomplete ordered navigation measurements");
  const execution = read(files[1]!);
  // Native report paths are package-relative; use a portable root when reopening the bundle.
  execution.config.rootDir = "/planned-source/packages/e2e";
  const expected = quarantineRegistry.filter(
    (entry) => entry.runner === "subnav-benchmark" && matchesPlatform(entry, run.target.platform, run.target.arch),
  );
  const result = browserBenchmarkResults(execution, expected, "/planned-source");
  if (result.executed !== 14) throw new Error("Incomplete or failed ordered navigation execution");
  return files;
};
