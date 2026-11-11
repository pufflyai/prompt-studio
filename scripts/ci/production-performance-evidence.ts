import { readFileSync } from "node:fs";
import { join } from "node:path";
import { benchmarkPlanEvidence } from "./benchmark-plan-evidence";
import { orderedPerformanceResult } from "./ordered-performance-reports";
import { performanceChecks } from "./production-performance-profile";
import type { PlannedRun, TestPlan } from "./test-plan";

export const productionPerformanceEvidence = (
  directory: string,
  run: PlannedRun,
  plan: TestPlan,
  executionId: string,
) => {
  const base = join(directory, "production-performance");
  const read = (file: string) => JSON.parse(readFileSync(join(base, file), "utf8"));
  const matches = (report: { planDigest: string; runId: string; executionId: string }) =>
    report.planDigest === plan.digest && report.runId === run.id && report.executionId === executionId;
  const metadata = read("metadata.json");
  const native = read("results.json");
  const checks = performanceChecks(run.productionFamily!);
  requireNativeRecords(metadata, native, run, plan, matches, checks);
  const reports = ["metadata.json", "results.json"];
  const reportedFiles = new Set<string>();
  let nativeFailure =
    native.outcome !== "success" ||
    native.results.some(
      (result: { outcome: string; exitCode: number }) => result.outcome !== "success" || result.exitCode !== 0,
    );
  for (const check of checks) {
    const log = `logs/0-${check.id}.log`;
    const header = JSON.parse(readFileSync(join(base, log), "utf8").split("\n")[0]!);
    if (header.id !== check.id || JSON.stringify(header.command) !== JSON.stringify(check.command))
      throw new Error("Missing native workload output");
    reports.push(log);
    if (["browser", "desktop"].includes(run.productionFamily!)) {
      const browser = browserResult(base, check.id, run, plan, executionId, matches);
      for (const file of browser.files) reportedFiles.add(file);
      nativeFailure ||= browser.nativeFailure;
      reports.push(...browser.reports);
    }
  }
  reports.push(...backendReports(base, run.productionFamily!));
  if (run.productionFamily === "navigation")
    reports.push(...benchmarkPlanEvidence(base, { ...run, benchmarkSuite: "subnav" }, plan.source));
  if (
    ["browser", "desktop"].includes(run.productionFamily!) &&
    (reportedFiles.size !== run.files.length || run.files.some((file) => !reportedFiles.has(file)))
  )
    throw new Error("Missing planned benchmark file coverage");
  return {
    nativeFailure,
    reports: reports.map((file) => `production-performance/${file}`),
    reportedFiles: ["browser", "desktop"].includes(run.productionFamily!) ? [...reportedFiles].sort() : run.files,
  };
};

interface NativeBrowserReport {
  complete: boolean;
  errors: unknown[];
  selected: string[];
  cases: { id: string; file: string }[];
}
const browserFiles = (report: NativeBrowserReport, run: PlannedRun) => {
  if (
    !report.complete ||
    report.errors.length ||
    !report.selected.length ||
    report.cases.length !== report.selected.length ||
    new Set(report.cases.map((entry) => entry.id)).size !== report.selected.length ||
    report.cases.some((entry) => !run.files.includes(entry.file) || !report.selected.includes(entry.id))
  )
    throw new Error("Missing native browser workload cases");
  return report.cases.map((entry) => entry.file);
};

interface NativeMetadata {
  planDigest: string;
  runId: string;
  executionId: string;
  sourceSha: string;
  versionSha: string;
  platform: string;
  arch: string;
  checks: ReturnType<typeof performanceChecks>;
}
interface NativeResults {
  planDigest: string;
  runId: string;
  executionId: string;
  complete: boolean;
  outcome: string;
  results: { id: string; exitCode: number | null; outcome: string }[];
}
const requireNativeRecords = (
  metadata: NativeMetadata,
  native: NativeResults,
  run: PlannedRun,
  plan: TestPlan,
  matches: (report: { planDigest: string; runId: string; executionId: string }) => boolean,
  checks: ReturnType<typeof performanceChecks>,
) => {
  if (
    !matches(metadata) ||
    !matches(native) ||
    metadata.sourceSha !== run.candidateSourceSha ||
    metadata.versionSha !== plan.source.sha ||
    metadata.platform !== run.target.platform ||
    metadata.arch !== run.target.arch ||
    JSON.stringify(metadata.checks) !== JSON.stringify(checks) ||
    !native.complete ||
    native.results.length !== checks.length ||
    native.results.some(
      (result: { id: string; exitCode: number | null }, index: number) =>
        result.id !== checks[index]!.id || result.exitCode === null,
    )
  )
    throw new Error("Incomplete fixed release workload");
};

const backendReports = (base: string, family: string) => {
  if (!["storage", "runtime"].includes(family)) return [];
  const file = `${family}.jsonl`;
  const metrics = readFileSync(join(base, file), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  if (!metrics.length || metrics.some((metric) => !metric.metric || !Number.isFinite(metric.value) || metric.value < 0))
    throw new Error("Incomplete backend measurements");
  return [file];
};

const browserResult = (
  base: string,
  id: string,
  run: PlannedRun,
  plan: TestPlan,
  executionId: string,
  matches: (report: { planDigest: string; runId: string; executionId: string }) => boolean,
) => {
  const file = `${id}-cases.json`;
  const report = JSON.parse(readFileSync(join(base, file), "utf8"));
  if (!matches(report)) throw new Error("Stale native browser report");
  const files = browserFiles(report, run);
  const ordered = orderedPerformanceResult(base, id, run, plan, executionId, report.selected.length);
  const nativeFailure = ordered
    ? ordered.nativeFailure
    : report.cases.some((entry: { outcome: string }) => !["passed", "skipped"].includes(entry.outcome));
  return { files, nativeFailure, reports: [file, ...(ordered?.reports ?? [])] };
};
