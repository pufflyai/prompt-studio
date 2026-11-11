import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { planHash, type SourceIdentity, type TestPlan, validateTestPlan } from "./test-plan";
import { testExecutionId } from "./test-plan-source";
import { collectRunEvidence, registeredStableEmpty } from "./test-run-evidence";

export interface TestRunResult {
  runId: string;
  planDigest: string;
  source: SourceIdentity;
  executionId: string;
  outcome: "success" | "failure" | "cancelled" | "not-run" | "quarantined-failure";
  complete: boolean;
  exitCode: number | null;
  reports: string[];
  reportedFiles?: string[];
  quarantine?: { executed: number; failures: number };
  reason?: string;
  elapsedMs?: number;
  nativeFailure?: boolean;
}
const resultErrors = (plan: TestPlan, result: TestRunResult, executionId: string) => {
  const errors: string[] = [];
  if (
    result.planDigest !== plan.digest ||
    result.executionId !== executionId ||
    planHash(result.source) !== planHash(plan.source)
  )
    errors.push(`Stale run: ${result.runId}`);
  if (result.nativeFailure && result.outcome === "success") errors.push(`Hidden native failure: ${result.runId}`);
  if (!result.complete) errors.push(`Incomplete run: ${result.runId}`);
  if (result.outcome === "success" && result.exitCode !== 0) errors.push(`Invalid successful exit: ${result.runId}`);
  if (
    result.outcome === "quarantined-failure" &&
    (plan.runs.find((run) => run.id === result.runId)?.lane !== "quarantine" ||
      result.exitCode !== 1 ||
      !result.quarantine?.failures)
  )
    errors.push(`Unverified quarantine failure: ${result.runId}`);
  if (result.outcome === "success" && result.quarantine?.failures)
    errors.push(`Hidden quarantine failure: ${result.runId}`);
  return errors;
};
export const reconcileTestResults = (
  plan: TestPlan,
  results: TestRunResult[],
  executionId: string,
  runIds = plan.runs.map((run) => run.id),
) => {
  validateTestPlan(plan);
  const errors: string[] = [];
  const expected = new Set(runIds);
  if (expected.size !== runIds.length || runIds.some((id) => !plan.runs.some((run) => run.id === id)))
    errors.push("Invalid run assignment");
  const seen = new Set<string>();
  for (const result of results) {
    if (!expected.has(result.runId)) errors.push(`Unexpected run: ${result.runId}`);
    if (seen.has(result.runId)) errors.push(`Duplicate run: ${result.runId}`);
    seen.add(result.runId);
    errors.push(...resultErrors(plan, result, executionId));
  }
  for (const id of expected) if (!seen.has(id)) errors.push(`Missing run: ${id}`);
  return {
    outcome:
      errors.length || results.some((result) => !["success", "quarantined-failure"].includes(result.outcome))
        ? "failure"
        : "success",
    complete: errors.length === 0,
    errors,
  };
};

const readBundle = (plan: TestPlan, file: string, directory: string, executionId: string) => {
  const records: TestRunResult[] = [];
  const bundle = JSON.parse(readFileSync(file, "utf8"));
  if (bundle.planDigest !== plan.digest || bundle.executionId !== executionId)
    throw new Error(`Stale result bundle: ${file}`);
  if (
    bundle.complete !== true ||
    bundle.phases?.some(
      (phase: { kind: string; complete: boolean; outcome: string }) =>
        phase.kind === "cleanup" && (!phase.complete || phase.outcome !== "success"),
    )
  )
    throw new Error(`Incomplete invocation or cleanup: ${file}`);
  for (const result of bundle.results as TestRunResult[]) {
    const run = plan.runs.find((candidate) => candidate.id === result.runId);
    if (!run) throw new Error(`Unexpected run: ${result.runId}`);
    const native = collectRunEvidence(directory, join(dirname(file), run.id), run, plan, executionId);
    records.push({ ...result, ...native, complete: result.complete && native.complete });
  }
  return records;
};
export const collectResultBundles = (plan: TestPlan, directory: string, executionId: string) => {
  const records: TestRunResult[] = [];
  const visit = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name === "execution.json") {
        records.push(...readBundle(plan, file, directory, executionId));
      }
    }
  };
  visit(resolve(directory));
  return records;
};
export const browserCoverageErrors = (plan: TestPlan, results: TestRunResult[]) => {
  const groups = new Map<string, typeof plan.runs>();
  for (const run of plan.runs.filter((run) =>
    ["app", "component", "desktop", "packaged-browser", "vite"].includes(run.runner),
  )) {
    const key = planHash({
      runner: run.runner,
      owner: run.owner,
      target: run.target,
      lane: run.lane,
      files: run.files,
      smoke: run.smoke,
    });
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  return [...groups.values()].flatMap((runs) => {
    const files = new Set(
      results
        .filter((result) => runs.some((run) => run.id === result.runId))
        .flatMap((result) => result.reportedFiles ?? []),
    );
    return runs[0]!.files
      .filter((file) => !files.has(file) && !registeredStableEmpty({ ...runs[0]!, files: [file] }))
      .map((file) => `Browser selection never reported: ${file}`);
  });
};
if (import.meta.main) {
  const [planPath, directory] = process.argv.slice(2);
  if (!planPath || !directory) throw new Error("Expected plan and result bundle directory");
  const plan = JSON.parse(readFileSync(planPath, "utf8")) as TestPlan;
  const executionId = testExecutionId();
  const records = collectResultBundles(plan, directory, executionId);
  const result = reconcileTestResults(plan, records, executionId);
  result.errors.push(...browserCoverageErrors(plan, records));
  if (result.errors.length) {
    result.outcome = "failure";
    result.complete = false;
  }
  await Bun.write("test-results/ci/plan-verification.json", JSON.stringify(result, null, 2));
  if (result.outcome !== "success") throw new Error(result.errors.join("\n") || "Planned tests failed");
}
