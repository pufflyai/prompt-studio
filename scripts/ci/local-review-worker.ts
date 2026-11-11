import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readReviewSource } from "./local-review-source";
import { runCiChecks } from "./run-ci-checks";
import { executePlan } from "./run-test-plan";
import type { TestPriority } from "./test-policy";

type ReviewCheck = { id: string; command: string[]; cwd: string; priority?: TestPriority };
const runSequence = async (
  checks: ReviewCheck[],
  run: (check: ReviewCheck, priority?: TestPriority) => Promise<boolean>,
  signal: AbortSignal,
  stopOnFailure = false,
) => {
  let passed = true;
  for (const check of checks) {
    if (signal.aborted) return false;
    if (!(await run(check, check.priority))) {
      passed = false;
      if (stopOnFailure) break;
    }
  }
  return passed;
};
const existingStaticChecks = (checks: ReviewCheck[], changed: string[], root: string) =>
  checks.filter((check) => {
    if (check.id !== "format") return true;
    check.command = check.command.filter((arg) => !changed.includes(arg) || existsSync(join(root, arg)));
    return check.command.some((arg) => changed.includes(arg));
  });

// Runs only inside the disposable checkout created by run-local-review.
export const executeLocalReview = async (
  root: string,
  base: string,
  tests: string[],
  report: string,
  buildCache?: string,
) => {
  const { head, plan } = readReviewSource(root, base, tests);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const results: { id: string; priority: TestPriority; command: string[]; outcome: string; elapsedMs: number }[] = [];
  let outcome = "incomplete";
  const save = () =>
    writeFile(
      report,
      `${JSON.stringify({ head, plan, results, outcome: controller.signal.aborted ? "interrupted" : outcome }, null, 2)}\n`,
    );
  const run = async (check: ReviewCheck, priority: TestPriority = "P0", cache?: string) => {
    const start = Date.now();
    const result = await runCiChecks([{ ...check, cwd: join(root, check.cwd) }], {
      priority,
      concurrency: 1,
      signal: controller.signal,
      inheritProcessGroup: true,
      logDirectory: join(
        root,
        "test-results/local-review",
        `${priority}-${check.id.replaceAll(/[^a-zA-Z0-9_-]/g, "_")}`,
      ),
      env: {
        TEST_PRIORITIES: priority,
        CI_PROFILE: "production",
        BUN_FEATURE_FLAG_NO_ORPHANS: undefined,
        NX_SELF_HOSTED_REMOTE_CACHE_SERVER: cache,
      },
    });
    results.push({
      id: check.id,
      priority,
      command: check.command,
      outcome: result.outcome,
      elapsedMs: Date.now() - start,
    });
    await save();
    return result.outcome === "success";
  };
  try {
    await save();
    // Builds finish before any consumer checks can read declarations or runtime assets.
    const built = await runSequence(
      plan.setup,
      (check, priority) => run(check, priority, buildCache),
      controller.signal,
      true,
    );
    await runSequence(existingStaticChecks(plan.staticChecks, plan.changed, root), run, controller.signal);
    let testsPassed = false;
    if (built) {
      await runSequence(plan.packageChecks, run, controller.signal);
      const execution = await executePlan(plan.testPlan, {
        root,
        prebuilt: true,
        signal: controller.signal,
        inheritProcessGroup: true,
        env: { CI_PROFILE: "production", BUN_FEATURE_FLAG_NO_ORPHANS: undefined },
      });
      testsPassed = execution.outcome === "success";
    }
    const passed =
      !controller.signal.aborted && built && testsPassed && results.every((entry) => entry.outcome === "success");
    outcome = passed ? "passed" : "failed";
    return passed ? 0 : 1;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await save();
  }
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const base = args[args.indexOf("--base") + 1];
  const report = args[args.indexOf("--report") + 1];
  const tests = args.flatMap((arg, index) => (arg === "--test" ? [args[index + 1]!] : []));
  if (!base || !report) throw new Error("Local review worker requires --base and --report");
  const buildCache = args.includes("--build-cache") ? args[args.indexOf("--build-cache") + 1] : undefined;
  process.exitCode = await executeLocalReview(resolve(import.meta.dir, "../.."), base, tests, report, buildCache);
}
