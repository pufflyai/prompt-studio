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
  let reports: string[] = [];
  let reason: string | undefined;
  let quarantine: { executed: number; failures: number } | undefined;
  let reportedFiles: string[] = [];
  let cases: ReportedCase[] = [];
  try {
    if (run.productionFamily) {
      reports = productionPerformanceEvidence(directory, run, plan, executionId);
      complete = true;
      reportedFiles = run.files;
    } else if (run.runner === "api") {
      const report = read("api/results.json");
      reports = ["api/results.json"];
      complete =
        report.complete &&
        report.sourceSha === plan.source.sha &&
        report.files.length === run.files.length &&
        run.files.every((file) =>
          report.files.some(
            (entry: {
              file: string;
              cases?: { complete: boolean; planDigest?: string; runId?: string; executionId?: string };
            }) => `${run.cwd}/${entry.file}` === file && entry.cases?.complete && identity(entry.cases),
          ),
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
      reportedFiles = report.files;
      if (run.runner === "performance") reports.push(...benchmarkPlanEvidence(directory, run, plan.source));
    }
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
    reason,
    quarantine,
    reportedFiles,
    reports: reports.map((file) => relative(root, join(directory, file)).replaceAll("\\", "/")),
  };
};
