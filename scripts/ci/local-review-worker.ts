import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readReviewSource } from "./local-review-source";
import { runCiChecks } from "./run-ci-checks";
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
export const executeLocalReview = async (root: string, base: string, tests: string[], report: string) => {
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
  const run = async (check: { id: string; command: string[]; cwd: string }, priority: TestPriority = "P0") => {
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
      env: { TEST_PRIORITIES: priority, CI_PROFILE: "production", BUN_FEATURE_FLAG_NO_ORPHANS: undefined },
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
    const built = await runSequence(plan.setup, run, controller.signal, true);
    await runSequence(existingStaticChecks(plan.staticChecks, plan.changed, root), run, controller.signal);
    if (built) await runSequence([...plan.packageChecks, ...plan.runs], run, controller.signal);
    const passed = !controller.signal.aborted && built && results.every((entry) => entry.outcome === "success");
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
  process.exitCode = await executeLocalReview(resolve(import.meta.dir, "../.."), base, tests, report);
}
