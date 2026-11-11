import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { benchmarkPlanEvidence } from "./benchmark-plan-evidence";
import { productionPerformanceEvidence } from "./production-performance-evidence";
import { verifyBunQuarantineCases } from "./quarantine-reports";
import type { PlannedRun, TestPlan } from "./test-plan";
import { matchesPlatform, quarantineRegistry, quarantineRunnerForTest } from "./test-quarantine";

interface ReportedCase {
  file: string;
  title: string;
  outcome: string;
}
export const registeredStableEmpty = (run: PlannedRun) =>
  run.lane === "stable" && run.files.every((file) => run.quarantineIds.some((id) => id.startsWith(`${file}:`)));
export const collectRunEvidence = (
  root: string,
  directory: string,
  run: PlannedRun,
  plan: TestPlan,
  executionId: string,
) => {
  const read = (name: string) => JSON.parse(readFileSync(join(directory, name), "utf8"));
  const identity = (report: { planDigest?: string; runId?: string; executionId?: string }) =>
    report.planDigest === plan.digest && report.runId === run.id && report.executionId === executionId;
  let complete = false;
  let nativeFailure = false;
  let reports: string[] = [];
  let reason: string | undefined;
  let quarantine: { executed: number; failures: number } | undefined;
  let reportedFiles: string[] = [];
  let cases: ReportedCase[] = [];
  try {
    if (run.productionFamily) {
      const evidence = productionPerformanceEvidence(directory, run, plan, executionId);
      nativeFailure = evidence.nativeFailure;
      reports = evidence.reports;
      complete = true;
      reportedFiles = evidence.reportedFiles;
    } else if (run.runner === "api") {
      const report = read("api/results.json");
      reports = ["api/results.json"];
      complete =
        report.complete &&
        report.sourceSha === plan.source.sha &&
        report.platform === run.target.platform &&
        report.arch === run.target.arch &&
        report.files.length === run.files.length &&
        run.files.every((file) =>
          report.files.some(
            (entry: {
              file: string;
              cases?: {
                complete: boolean;
                planDigest?: string;
                runId?: string;
                executionId?: string;
                sourceSha: string;
                reportedFiles: string[];
              };
            }) =>
              `${run.cwd}/${entry.file}` === file &&
              entry.cases?.complete &&
              identity(entry.cases) &&
              entry.cases.sourceSha === plan.source.sha &&
              entry.cases.reportedFiles.length === 1 &&
              entry.cases.reportedFiles[0] === file,
          ),
        );
      nativeFailure = report.files.some(
        (entry: { outcome: string; exitCode: number }) => entry.outcome !== "success" || entry.exitCode !== 0,
      );
      cases = report.files.flatMap((entry: { cases?: { cases: ReportedCase[] } }) => entry.cases?.cases ?? []);
      reportedFiles = [...new Set(cases.map((entry) => entry.file))];
    } else if (["app", "component", "desktop", "packaged-browser", "vite"].includes(run.runner)) {
      const report = read("browser.json");
      reports = ["browser.json"];
      complete =
        identity(report) &&
        report.complete &&
        report.shard === (run.shard ?? "1/1") &&
        (report.selected.length > 0 || registeredStableEmpty(run)) &&
        !report.errors.length &&
        report.cases.length === report.selected.length &&
        new Set(report.selected).size === report.selected.length &&
        new Set(report.cases.map((entry: { id: string }) => entry.id)).size === report.selected.length &&
        report.cases.every(
          (entry: { id: string; file: string }) => report.selected.includes(entry.id) && run.files.includes(entry.file),
        );
      cases = report.cases.map((entry: ReportedCase) => ({
        ...entry,
        outcome: ({ passed: "success", skipped: "skipped" } as Record<string, string>)[entry.outcome] ?? "failure",
      }));
      reportedFiles = [...new Set(cases.map((entry) => entry.file))];
    } else if (["bun", "cli", "browser-helper", "packaged-cli"].includes(run.runner)) {
      const report = read("cases.json");
      reports = ["cases.json"];
      complete =
        identity(report) &&
        report.complete &&
        !report.reportError &&
        !report.signal &&
        report.sourceSha === plan.source.sha &&
        run.files.every((file) => report.reportedFiles.includes(file)) &&
        report.reportedFiles.every((file: string) => run.files.includes(file));
      cases = report.cases;
      reportedFiles = report.reportedFiles;
    } else {
      const report = read("lifecycle.json");
      reports = ["lifecycle.json"];
      complete = identity(report) && report.complete && JSON.stringify(report.files) === JSON.stringify(run.files);
      nativeFailure = report.outcome === "failure";
      reportedFiles = report.files;
      if (run.runner === "performance") reports.push(...benchmarkPlanEvidence(directory, run, plan.source));
    }
    nativeFailure ||= cases.some((entry) => entry.outcome === "failure");
    if (run.lane === "quarantine") {
      const expected = quarantineRegistry.filter(
        (entry) =>
          entry.runner === quarantineRunnerForTest(run.runner) &&
          matchesPlatform(entry, run.target.platform, run.target.arch) &&
          run.quarantineIds.includes(`${entry.file}:${entry.name}`),
      );
      if (!expected.length || expected.length !== run.quarantineIds.length)
        throw new Error("Unregistered quarantine selection");
      quarantine = verifyBunQuarantineCases(cases, expected);
    }
    if (!complete) reason = "Runner evidence is incomplete or does not match the selected plan";
  } catch (error) {
    complete = false;
    reason = `Missing or invalid runner evidence: ${error}`;
  }
  return {
    complete,
    nativeFailure,
    reason,
    quarantine,
    reportedFiles,
    reports: reports.map((file) => relative(root, join(directory, file)).replaceAll("\\", "/")),
  };
};
