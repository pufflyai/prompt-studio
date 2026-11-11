import { readFileSync } from "node:fs";
import { join } from "node:path";
import { orderedPerformanceResult } from "./ordered-performance-reports";
import type { PlannedRun, TestPlan } from "./test-plan";

// Reopen native reports after transport; lifecycle summaries alone cannot certify a workload.
const benchmarkMeasurements = (directory: string, run: PlannedRun, plan: TestPlan) => {
  const read = (file: string) => JSON.parse(readFileSync(join(directory, file), "utf8"));
  let reports: string[];
  if (run.benchmarkSuite === "subnav") {
    reports = ["performance/subnav/results.json"];
    const measurements = read(reports[0]!);
    const order = ["ticket/first", "sessions/first", "ticket/repeat", "sessions/repeat"];
    if (
      measurements.sourceCommit !== plan.source.sha ||
      measurements.platform !== `${run.target.platform}/${run.target.arch}` ||
      measurements.samples.length !== 120 ||
      measurements.samples.some(
        (sample: { destination: string; visit: string }, index: number) =>
          `${sample.destination}/${sample.visit}` !== order[index % 4],
      )
    )
      throw new Error("Incomplete ordered navigation measurements");
  } else if (run.benchmarkSuite === "planner") {
    reports = ["performance/planner.jsonl"];
    const measurements = readFileSync(join(directory, reports[0]!), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    if (
      measurements.length !== 3 ||
      measurements.some((entry) => entry.metric !== "cold-open" || !Number.isFinite(entry.value) || entry.value < 0)
    )
      throw new Error("Incomplete planner cold-open measurements");
  } else {
    reports = [`performance/${plan.source.sha}-${run.target.platform}-${run.target.arch}.json`];
    const report = read(reports[0]!);
    if (
      report.format !== 1 ||
      report.commit.sha !== plan.source.sha ||
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
  }
  return reports;
};

export const benchmarkPlanEvidence = (directory: string, run: PlannedRun, plan: TestPlan, executionId: string) => {
  const reports = benchmarkMeasurements(directory, run, plan);
  let nativeFailure = false;
  const files = new Set<string>();
  const profiles: Record<string, string> = { desktop: "desktop", workbench: "frontend", subnav: "sidenav-subnav" };
  const profile = profiles[run.benchmarkSuite!];
  if (profile) {
    const ordered = orderedPerformanceResult(directory, profile, run, plan, executionId)!;
    reports.push(...ordered.reports);
    nativeFailure ||= ordered.nativeFailure;
    for (const file of ordered.reportedFiles) files.add(file);
  }
  if (["workbench", "canvas", "chat"].includes(run.benchmarkSuite!)) {
    const browser = browserEvidence(
      JSON.parse(readFileSync(join(directory, "browser.json"), "utf8")),
      run,
      plan,
      executionId,
    );
    nativeFailure ||= browser.nativeFailure;
    for (const file of browser.files) files.add(file);
    reports.push("browser.json");
  }
  if (profile || ["canvas", "chat"].includes(run.benchmarkSuite!)) {
    if (files.size !== run.files.length || run.files.some((file) => !files.has(file)))
      throw new Error("Missing planned benchmark file coverage");
  }
  return { reports, nativeFailure, reportedFiles: run.files };
};

interface BrowserReport {
  planDigest: string;
  runId: string;
  executionId: string;
  complete: boolean;
  errors: unknown[];
  selected: string[];
  cases: { id: string; file: string; outcome: string }[];
}
const browserEvidence = (report: BrowserReport, run: PlannedRun, plan: TestPlan, executionId: string) => {
  if (
    report.planDigest !== plan.digest ||
    report.runId !== run.id ||
    report.executionId !== executionId ||
    !report.complete ||
    report.errors.length ||
    !report.selected.length ||
    report.cases.length !== report.selected.length ||
    new Set(report.selected).size !== report.selected.length ||
    new Set(report.cases.map((entry) => entry.id)).size !== report.selected.length ||
    report.cases.some((entry) => !report.selected.includes(entry.id) || !run.files.includes(entry.file))
  )
    throw new Error("Incomplete source browser benchmark execution");
  return {
    nativeFailure: report.cases.some((entry) => !["passed", "skipped"].includes(entry.outcome)),
    files: report.cases.map((entry) => entry.file),
  };
};
