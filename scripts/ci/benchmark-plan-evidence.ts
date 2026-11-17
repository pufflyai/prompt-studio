import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scenarioEvidence } from "pstdio-benchmarks/writer";
import type { PlannedRun, TestPlan } from "./test-plan";
export const benchmarkPlanEvidence = (directory: string, run: PlannedRun, plan: TestPlan, executionId: string) => {
  const id = run.benchmarkSuite!;
  const lock = JSON.parse(readFileSync("packages/benchmarks/catalog.lock.json", "utf8"));
  const file = `performance/${id}.jsonl`;
  const result = scenarioEvidence(join(directory, file), id, {
    source: plan.source.sha,
    platform: `${run.target.platform}-${run.target.arch}`,
    catalogDigest: lock.digest,
    planDigest: plan.digest,
    runId: run.id,
    executionId,
  });
  return { reports: [file], nativeFailure: result.nativeFailure, reportedFiles: run.files };
};
