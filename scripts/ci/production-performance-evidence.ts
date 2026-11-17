import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scenarioEvidence } from "pstdio-benchmarks/writer";
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
  const metadata = read("metadata.json");
  const native = read("results.json");
  const platform = `${run.target.platform}-${run.target.arch}`;
  const checks = performanceChecks(run.productionFamily!, platform);
  if (
    !checks.length ||
    [metadata, native].some(
      (record) => record.planDigest !== plan.digest || record.runId !== run.id || record.executionId !== executionId,
    ) ||
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
    throw new Error("Incomplete or stale frozen release workload");
  const lock = JSON.parse(readFileSync("packages/benchmarks/catalog.lock.json", "utf8"));
  let nativeFailure = native.outcome !== "success";
  const reports = ["metadata.json", "results.json"];
  for (const check of checks) {
    const file = `${check.id}.jsonl`;
    const evidence = scenarioEvidence(join(base, file), check.id, {
      source: plan.source.sha,
      platform,
      catalogDigest: lock.digest,
      planDigest: plan.digest,
      runId: run.id,
      executionId,
    });
    nativeFailure ||= evidence.nativeFailure;
    reports.push(file, `logs/0-${check.id}.log`);
  }
  return { nativeFailure, reports: reports.map((file) => `production-performance/${file}`), reportedFiles: run.files };
};
