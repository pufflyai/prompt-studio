import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCiChecks } from "./run-ci-checks";
import { runnerCommand } from "./runner-profiles";
import type { PlannedRun, TestPlan } from "./test-plan";
import { collectRunEvidence } from "./test-run-evidence";
import type { TestRunResult } from "./verify-test-results";

interface RunOptions {
  root: string;
  directory: string;
  executionId: string;
  signal: AbortSignal;
  env?: NodeJS.ProcessEnv;
  inheritProcessGroup?: boolean;
}
export const runPlannedTest = async (plan: TestPlan, run: PlannedRun, result: TestRunResult, options: RunOptions) => {
  const { root, directory, executionId, signal } = options;
  const evidence = join(directory, run.id);
  mkdirSync(evidence, { recursive: true });
  const command = plannedTestCommand(run, root, evidence);
  const start = performance.now();
  const outcome = await runCiChecks([{ id: run.id, cwd: join(root, run.cwd), command }], {
    priority: run.lane === "quarantine" ? "P2" : run.priority,
    concurrency: 1,
    signal,
    inheritProcessGroup: options.inheritProcessGroup,
    observePeers: Boolean(process.env.GITHUB_ACTIONS) && !run.continueIndependentFiles,
    logDirectory: join(evidence, "logs"),
    env: {
      ...options.env,
      TEST_PRIORITIES: run.priority,
      CI_PRIORITY: run.lane === "quarantine" ? "P2" : run.priority,
      CI_PLAN_DIGEST: plan.digest,
      CI_PLAN_RUN_ID: run.id,
      CI_TEST_EXECUTION_ID: executionId,
      CI_TEST_ROOT: root,
      CI_PLAN_SOURCE_SHA: plan.source.sha,
      CI_PLAN_RUN_FILES: JSON.stringify(run.files),
      CI_PLAN_REPORTER: join(root, "scripts/ci/plan-playwright-reporter.ts"),
      CI_PLAN_BROWSER_EVIDENCE: join(evidence, "browser.json"),
      CI_PLAN_FIXTURE_STATS: join(evidence, "fixture-inputs.json"),
      CI_PLAN_SHARD: run.shard ?? "1/1",
      BUN_TEST_EVIDENCE_FILE: join(evidence, "cases.json"),
      API_TEST_REPORT_DIR: join(evidence, "api"),
      ...(run.componentOwner ? { CANVAS_TEST_PACKAGES: run.componentOwner } : {}),
      E2E_TEST_LANE: run.lane === "quarantine" ? "quarantine" : "stable",
      ...(run.priority === "P3" ? { UI_PERF_ASSERT_BUDGETS: "1" } : {}),
      E2E_PACKAGED_BINARY_PATH:
        process.env.E2E_PACKAGED_BINARY_PATH ??
        join(root, "dist", process.platform === "win32" ? "pstdio.exe" : "pstdio"),
    },
  });
  result.exitCode = outcome.results[0]?.exitCode ?? null;
  result.outcome = outcome.results[0]?.outcome ?? "cancelled";
  result.elapsedMs = performance.now() - start;
  if (run.runner === "integration") {
    // These executable contracts use native assertions and own cleanup rather than a test framework.
    writeFileSync(
      join(evidence, "lifecycle.json"),
      JSON.stringify({
        planDigest: plan.digest,
        runId: run.id,
        executionId,
        files: run.files,
        complete: result.exitCode !== null && !signal.aborted,
        outcome: result.outcome,
      }),
    );
  }
  Object.assign(result, collectRunEvidence(root, evidence, run, plan, executionId));
  if (result.nativeFailure && result.outcome === "success") result.outcome = "failure";
  if (run.lane === "quarantine" && result.complete && result.exitCode === 1 && result.quarantine?.failures)
    result.outcome = "quarantined-failure";

  return result.elapsedMs;
};

const plannedTestCommand = (run: PlannedRun, root: string, evidence: string) => {
  let command: string[];
  if (run.productionFamily)
    command = ["bun", join(root, "scripts/ci/run-production-performance.ts"), run.productionFamily, evidence];
  else if (run.benchmarkSuite)
    command = ["bun", join(root, "scripts/ci/run-benchmark-plan.ts"), run.benchmarkSuite, evidence];
  else
    command = runnerCommand(
      run.runner,
      run.files,
      { name: run.owner, dir: run.cwd, dependencies: [], scripts: {} },
      run.componentOwner,
    );
  if (run.smoke) command.push("--config", "playwright.smoke.config.ts");
  if (run.shard && ["app", "component", "desktop", "packaged-browser", "vite"].includes(run.runner))
    command.push(`--shard=${run.shard}`);
  if (run.windowsAllowance) command.push("--timeout=15000");
  if (
    run.quarantineIds.length &&
    run.lane === "stable" &&
    ["app", "component", "desktop", "packaged-browser"].includes(run.runner)
  )
    command.push("--pass-with-no-tests");
  return command;
};
