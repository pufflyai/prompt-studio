import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { runCiChecks } from "./run-ci-checks";
import { runPlannedTest } from "./run-planned-test";
import { type TestPhase, testPhase } from "./test-phase";
import { type SetupStep, type TestPlan, validateTestPlan } from "./test-plan";
import { testExecutionId, testPlanSource } from "./test-plan-source";
import { stopsAtFirstFailure } from "./test-policy";
import { reconcileTestResults, type TestRunResult } from "./verify-test-results";

interface Options {
  root: string;
  runIds?: string[];
  prebuilt?: boolean;
  executionId?: string;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  inheritProcessGroup?: boolean;
  report?: string;
}
const setupCommand = (step: SetupStep, directory: string) => {
  if (step.kind === "extension-fixtures")
    return [
      "bun",
      "packages/e2e/src/scripts/prepare-ui-fixtures.ts",
      "--out",
      join(directory, step.id),
      "--extensions",
      JSON.stringify(step.owners),
    ];
  if (step.kind === "build")
    return [
      "bun",
      "run",
      "build",
      "--",
      ...step.owners.flatMap((owner) => ["--scope", owner]),
      "--include-dependencies",
    ];
  if (step.kind === "canvas")
    return ["bun", "x", "--no-install", "lerna", "run", "build:previews", "--scope", "canvas-tests"];
  return ["bun", "run", "--cwd", "clients/desktop", "package"];
};
export const executePlan = async (plan: TestPlan, options: Options) => {
  const { root } = options;
  validateTestPlan(plan, testPlanSource(root));
  const runIds = options.runIds ?? plan.runs.map((run) => run.id);
  const runs = assignedRuns(plan, runIds);
  const executionId = options.executionId ?? testExecutionId();
  const directory = process.env.CI_PLAN_OUTPUT_DIR
    ? join(root, process.env.CI_PLAN_OUTPUT_DIR)
    : join(root, "test-results/ci/planned", `${process.pid}-${Date.now()}`);
  mkdirSync(directory, { recursive: true });
  const results: TestRunResult[] = [];
  let cleanupFailed = false;
  const phases: TestPhase[] = [];
  const identity = { source: plan.source, planDigest: plan.digest, executionId, job: process.env.GITHUB_JOB ?? null };
  const record = (values: Parameters<typeof testPhase>[1]) => phases.push(testPhase(identity, values));
  const started = performance.now();
  const save = () =>
    writeFileSync(
      options.report ?? join(directory, "execution.json"),
      JSON.stringify(
        {
          planDigest: plan.digest,
          source: plan.source,
          executionId,
          runIds,
          results,
          phases,
          elapsedMs: performance.now() - started,
          ...reconcileTestResults(plan, results, executionId, runIds),
          ...(cleanupFailed ? { outcome: "failure", complete: false } : {}),
        },
        null,
        2,
      ),
    );
  const controller = new AbortController();
  const interrupt = () => controller.abort("Execution interrupted");
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  const prepare = createSetupRunner(plan, options, signal, directory, record, save);
  let p1Failed = false;
  save();
  try {
    for (const run of runs) {
      const result: TestRunResult = {
        runId: run.id,
        planDigest: plan.digest,
        source: plan.source,
        executionId,
        outcome: "not-run",
        complete: false,
        exitCode: null,
        reports: [],
      };
      results.push(result);
      const reason = cancellationReason(run, signal, p1Failed);
      if (reason) {
        result.outcome = "cancelled";
        result.reason = reason;
        save();
        continue;
      }
      if (!(await prepare(run.requires))) {
        result.reason = "Prerequisite failed";
        save();
        continue;
      }
      const fixtures = run.requires.find((id) =>
        plan.setup.some((step) => step.id === id && step.kind === "extension-fixtures"),
      );
      const elapsedMs = await runPlannedTest(plan, run, result, {
        root,
        directory,
        executionId,
        signal,
        env: { ...options.env, E2E_PREPARED_FIXTURES: fixtures ? join(directory, fixtures) : undefined },
        inheritProcessGroup: options.inheritProcessGroup,
      });
      if (result.outcome !== "success" || !result.complete)
        p1Failed ||= stopsAtFirstFailure(run.priority, options.env?.CI_PROFILE) && run.lane !== "quarantine";
      record({ kind: "test", id: run.id, elapsedMs, outcome: result.outcome });
      save();
    }
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    cleanupFailed = !cleanupPreparedFixtures(plan, directory, record);
    save();
  }
  const verification = reconcileTestResults(plan, results, executionId, runIds);
  console.log(`Test plan ${plan.digest.slice(0, 12)}: ${verification.outcome}; evidence ${relative(root, directory)}`);
  return { ...verification, ...(cleanupFailed ? { outcome: "failure", complete: false } : {}), results, phases };
};

const createSetupRunner = (
  plan: TestPlan,
  options: Options,
  signal: AbortSignal,
  directory: string,
  record: (values: Parameters<typeof testPhase>[1]) => void,
  save: () => void,
) => {
  const root = options.root;
  const prepared = new Map<string, boolean>();
  const prepare = async (ids: string[]) => {
    const steps: SetupStep[] = [];
    const visit = (id: string) => {
      if (prepared.has(id) || steps.some((step) => step.id === id)) return;
      const step = plan.setup.find((item) => item.id === id)!;
      for (const required of step.requires) visit(required);
      steps.push(step);
    };
    for (const id of ids) visit(id);
    for (const step of steps) {
      if (step.requires.some((id) => !prepared.get(id))) {
        prepared.set(step.id, false);
        continue;
      }
      if (options.prebuilt && step.kind !== "extension-fixtures") {
        prepared.set(step.id, true);
        record({ kind: step.kind, id: step.id, elapsedMs: 0, outcome: "success", cacheOutcome: "prebuilt" });
        continue;
      }
      const start = performance.now();
      const result = await runCiChecks([{ id: step.id, cwd: root, command: setupCommand(step, directory) }], {
        priority: "P0",
        concurrency: 1,
        signal,
        env: options.env,
        inheritProcessGroup: options.inheritProcessGroup,
      });
      record({ kind: step.kind, id: step.id, elapsedMs: performance.now() - start, outcome: result.outcome });
      prepared.set(step.id, result.outcome === "success");
      save();
    }
    return ids.every((id) => prepared.get(id));
  };
  return prepare;
};

const assignedRuns = (plan: TestPlan, runIds: string[]) => {
  if (new Set(runIds).size !== runIds.length || runIds.some((id) => !plan.runs.some((run) => run.id === id)))
    throw new Error("Unknown or duplicate assigned run ID");
  const runs = runIds.map((id) => plan.runs.find((run) => run.id === id)!);
  for (const run of runs)
    if (run.target.platform !== process.platform || run.target.arch !== process.arch)
      throw new Error(`Run ${run.id} requires ${run.target.platform}/${run.target.arch}`);
  return runs;
};

const cancellationReason = (run: TestPlan["runs"][number], signal: AbortSignal, p1Failed: boolean) => {
  if (signal.aborted) return "Execution interrupted";
  if (p1Failed && run.priority === "P1" && !run.continueIndependentFiles) return "Stopped after a P1 failure";
};

const cleanupPreparedFixtures = (
  plan: TestPlan,
  directory: string,
  record: (values: Parameters<typeof testPhase>[1]) => void,
) => {
  const started = performance.now();
  let outcome = "success";
  try {
    for (const step of plan.setup.filter((step) => step.kind === "extension-fixtures"))
      rmSync(join(directory, step.id), { recursive: true, force: true });
  } catch (error) {
    outcome = "failure";
    console.error("Prepared fixture cleanup failed", error);
  }
  record({ kind: "cleanup", id: "prepared-fixtures", elapsedMs: performance.now() - started, outcome });
  return outcome === "success";
};
