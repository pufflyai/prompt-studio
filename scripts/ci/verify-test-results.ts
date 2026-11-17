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
// A rerun may retain successful jobs, but never evidence from another workflow or the future.
const workflowAttempt = (actual: string, expected: string) => {
  if (actual === expected) return Number(/\/(\d+)$/.exec(actual)?.[1] ?? 0);
  const candidate = /^(\d+)\/([1-9]\d*)$/.exec(actual);
  const current = /^(\d+)\/([1-9]\d*)$/.exec(expected);
  if (!candidate || !current || candidate[1] !== current[1] || Number(candidate[2]) >= Number(current[2]))
    throw new Error(`Stale execution: ${actual}; expected ${expected}`);
  return Number(candidate[2]);
};

const validResultExecution = (result: TestRunResult, executionId: string) => {
  try {
    workflowAttempt(result.executionId, executionId);
    return result.executionId === executionId || ["success", "quarantined-failure"].includes(result.outcome);
  } catch {
    return false;
  }
};

const resultErrors = (plan: TestPlan, result: TestRunResult, executionId: string) => {
  const errors: string[] = [];
  if (
    result.planDigest !== plan.digest ||
    !validResultExecution(result, executionId) ||
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

const readBundle = (plan: TestPlan, file: string, directory: string, executionId: string, errors: string[]) => {
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
    errors.push(`Incomplete invocation or cleanup: ${file}`);
  for (const result of bundle.results as TestRunResult[]) {
    const source = result?.source;
    if (
      !source ||
      ![source.sha, source.tree, source.policy].every((value) => typeof value === "string") ||
      typeof source.dirty !== "boolean" ||
      typeof result.complete !== "boolean" ||
      !["success", "failure", "cancelled", "not-run", "quarantined-failure"].includes(result.outcome) ||
      !(result.exitCode === null || Number.isInteger(result.exitCode))
    )
      throw new Error(`Invalid run record: ${result?.runId}`);
    if (
      result.planDigest !== plan.digest ||
      result.executionId !== executionId ||
      planHash(source) !== planHash(plan.source)
    )
      throw new Error(`Stale run identity: ${result.runId}`);
    const run = plan.runs.find((candidate) => candidate.id === result.runId);
    if (!run) throw new Error(`Unexpected run: ${result.runId}`);
    const native = collectRunEvidence(directory, join(dirname(file), run.id), run, plan, executionId);
    records.push({
      ...result,
      ...native,
      complete: result.complete && native.complete,
      reason: [result.reason, native.reason].filter(Boolean).join("; ") || undefined,
    });
  }
  return records;
};
export const collectResultBundles = (plan: TestPlan, directory: string, executionId: string) => {
  const errors: string[] = [];
  const invocations: Array<{
    file: string;
    executionId: string;
    attempt: number;
    assigned: string[];
    records: TestRunResult[];
    errors: string[];
  }> = [];
  const readInvocation = (file: string) => {
    const bundle = JSON.parse(readFileSync(file, "utf8"));
    const attempt = workflowAttempt(bundle.executionId, executionId);
    const assigned: string[] = bundle.runIds ?? bundle.results.map((result: TestRunResult) => result.runId);
    if (new Set(assigned).size !== assigned.length || assigned.some((id) => !plan.runs.some((run) => run.id === id)))
      throw new Error("Invalid run assignment");
    if (bundle.results.some((result: TestRunResult) => !assigned.includes(result.runId)))
      throw new Error("Result outside its invocation assignment");
    const invocationErrors: string[] = [];
    const records = readBundle(plan, file, directory, bundle.executionId, invocationErrors);
    return {
      file,
      executionId: bundle.executionId,
      attempt,
      assigned,
      records,
      errors: invocationErrors,
    };
  };
  const visit = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name === "execution.json") {
        try {
          invocations.push(readInvocation(file));
        } catch (error) {
          errors.push(`Invalid result bundle ${file}: ${error}`);
        }
      }
    }
  };
  try {
    visit(resolve(directory));
  } catch (error) {
    errors.push(`Cannot read result bundles ${directory}: ${error}`);
  }
  const latest = new Map<string, number>();
  for (const invocation of invocations)
    for (const id of invocation.assigned) latest.set(id, Math.max(latest.get(id) ?? -1, invocation.attempt));
  const records: TestRunResult[] = [];
  const assignments = new Set<string>();
  for (const invocation of invocations) {
    const selected = invocation.assigned.filter((id) => latest.get(id) === invocation.attempt);
    if (!selected.length) continue;
    for (const id of selected) {
      if (assignments.has(id)) errors.push(`Duplicate newest assignment: ${id}`);
      assignments.add(id);
    }
    errors.push(...invocation.errors);
    records.push(...invocation.records.filter((record) => selected.includes(record.runId)));
  }
  return { records, errors, observations: invocations.flatMap((invocation) => invocation.records), invocations };
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
  const { records, errors, observations, invocations } = collectResultBundles(plan, directory, executionId);
  const result = reconcileTestResults(plan, records, executionId);
  result.errors.push(...errors, ...browserCoverageErrors(plan, records));
  if (result.errors.length) {
    result.outcome = "failure";
    result.complete = false;
  }
  await Bun.write(
    "test-results/ci/plan-verification.json",
    JSON.stringify({ ...result, results: records, observations, invocations }, null, 2),
  );
  if (result.outcome !== "success") {
    const failures = records
      .filter((record) => !["success", "quarantined-failure"].includes(record.outcome) || !record.complete)
      .map((record) => `${record.runId}: ${record.outcome}${record.reason ? ` (${record.reason})` : ""}`);
    throw new Error([...result.errors, ...failures].join("\n") || "Planned tests failed");
  }
}
