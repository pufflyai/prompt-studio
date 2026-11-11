import { readFileSync } from "node:fs";
import { join } from "node:path";
import { benchmarkPlanEvidence } from "./benchmark-plan-evidence";
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
  const reports = ["metadata.json", "results.json"];
  for (const check of checks) {
    const log = `logs/0-${check.id}.log`;
    const header = JSON.parse(readFileSync(join(base, log), "utf8").split("\n")[0]!);
    if (header.id !== check.id || JSON.stringify(header.command) !== JSON.stringify(check.command))
      throw new Error("Missing native workload output");
    reports.push(log);
    if (["browser", "desktop"].includes(run.productionFamily!)) {
      const file = `${check.id}-cases.json`;
      const report = read(file);
      if (
        !matches(report) ||
        !report.complete ||
        report.errors.length ||
        !report.selected.length ||
        report.cases.length !== report.selected.length ||
        new Set(report.cases.map((entry: { id: string }) => entry.id)).size !== report.selected.length ||
        report.cases.some(
          (entry: { file: string; id: string }) =>
            !run.files.includes(entry.file) || !report.selected.includes(entry.id),
        )
      )
        throw new Error("Missing native browser workload cases");
      reports.push(file);
    }
  }
  if (["storage", "runtime"].includes(run.productionFamily!)) {
    const file = `${run.productionFamily}.jsonl`;
    const metrics = readFileSync(join(base, file), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    if (
      !metrics.length ||
      metrics.some((metric) => !metric.metric || !Number.isFinite(metric.value) || metric.value < 0)
    )
      throw new Error("Incomplete backend measurements");
    reports.push(file);
  }
  if (run.productionFamily === "navigation")
    reports.push(...benchmarkPlanEvidence(base, { ...run, benchmarkSuite: "subnav" }, plan.source));
  return reports.map((file) => `production-performance/${file}`);
};
