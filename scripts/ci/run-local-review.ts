import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { cleanupReviewCompose } from "./local-review-compose";
import { localReviewEnvironment, readReviewSource } from "./local-review-source";
import { runCiChecks } from "./run-ci-checks";

const localReviewTargetMs = 15 * 60 * 1000;

export const runLocalReview = async (root: string, base: string, additionalTests: string[], list = false) => {
  const started = Date.now();
  const source = readReviewSource(root, base, additionalTests);
  if (source.dirty)
    throw new Error(
      "Commit the candidate before test:review. Use focused package tests during development; no dirty source is certified.",
    );
  if (list) {
    console.log(JSON.stringify({ head: source.head, mergeBase: source.mergeBase, ...source.plan }, null, 2));
    return 0;
  }
  if (process.platform === "win32")
    throw new Error("Local review isolation currently supports macOS and Linux; use isolated CI on Windows.");
  const directory = await mkdtemp(join(tmpdir(), "pstdio-local-review-"));
  const checkout = join(directory, "source");
  const reportPath = join(root, "test-results", "local-review", `${basename(directory)}.json`);
  await mkdir(resolve(reportPath, ".."), { recursive: true });
  const controller = new AbortController();
  const interrupt = () => controller.abort("interrupted");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  const timer = setTimeout(
    () => console.warn("Local review exceeded the 15-minute target; continuing every selected check to completion."),
    Math.max(0, localReviewTargetMs - (Date.now() - started)),
  );
  const phases: { id: string; elapsedMs: number; outcome: string; results: unknown; command: string[] }[] = [];
  let error: string | undefined;
  let complete = false;
  let composeCleanup: Awaited<ReturnType<typeof cleanupReviewCompose>> = [];
  const env = { ...localReviewEnvironment(directory), BUN_FEATURE_FLAG_NO_ORPHANS: "1" };
  const run = async (id: string, command: string[], cwd: string) => {
    const phaseStart = Date.now();
    const result = await runCiChecks([{ id, command, cwd }], {
      priority: "P0",
      concurrency: 1,
      env,
      signal: controller.signal,
      cleanupOnExit: true,
      logDirectory: join(directory, "logs", id),
    });
    phases.push({ id, command, elapsedMs: Date.now() - phaseStart, ...result });
    await save();
    if (result.outcome !== "success")
      throw new Error(`${id}: ${controller.signal.aborted ? controller.signal.reason : "failed"}`);
  };
  const outcome = () => {
    if (complete) return "local_passed";
    if (controller.signal.aborted) return "interrupted";
    if (error) return "failed";
    return "incomplete";
  };
  const save = () =>
    writeFile(
      reportPath,
      `${JSON.stringify(
        {
          head: source.head,
          mergeBase: source.mergeBase,
          startedAt: new Date(started).toISOString(),
          elapsedMs: Date.now() - started,
          targetMs: localReviewTargetMs,
          exceededTarget: Date.now() - started > localReviewTargetMs,
          outcome: outcome(),
          reason: controller.signal.reason ?? error,
          directory,
          source: checkout,
          plan: source.plan,
          phases,
          composeCleanup,
          requiredCi:
            "Latest-head ci_passed, plus evidence for every deferred check; local_passed is not review-ready by itself.",
        },
        null,
        2,
      )}\n`,
    );
  console.log(`Local review ${source.head}\nReport: ${reportPath}\nDisposable checkout: ${checkout}`);
  try {
    await save();
    // This scratch clone is not an implementation workspace and runs no workspace hooks.
    await run("snapshot", ["git", "clone", "--shared", "--no-checkout", "--quiet", root, checkout], root);
    await run("checkout", ["git", "checkout", "--detach", source.head], checkout);
    await run("install", ["bun", "install", "--frozen-lockfile", "--concurrent-scripts", "1"], checkout);
    await run(
      "validation",
      [
        "bun",
        "--no-orphans",
        "scripts/ci/local-review-worker.ts",
        "--base",
        source.mergeBase,
        ...additionalTests.flatMap((file) => ["--test", file]),
        "--report",
        join(directory, "checks.json"),
      ],
      checkout,
    );
    complete = !controller.signal.aborted;
  } catch (caught) {
    error = String(caught);
    console.error(error);
  } finally {
    try {
      composeCleanup = await cleanupReviewCompose(directory);
      if (composeCleanup.some((entry) => entry.outcome !== "success")) {
        complete = false;
        error = "Owned Compose cleanup failed";
      }
    } catch (caught) {
      complete = false;
      error = String(caught);
      console.error(error);
    }
    clearTimeout(timer);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    await save();
  }
  console.log(`Local review ${complete ? "passed" : "unfinished"}: ${reportPath}`);
  // Keep the private checkout, logs and traces as evidence, including after interruption.
  // Cleanup only targets owned processes; no shared stack or cache is removed.
  return complete ? 0 : 1;
};

export const reviewOptions = (args: string[]) => {
  let base = "origin/main";
  let list = false;
  const tests: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--") continue;
    if (arg === "--list") {
      list = true;
      continue;
    }
    if (arg !== "--base" && arg !== "--test") throw new Error(`Unknown option: ${arg}`);
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    if (arg === "--base") base = value;
    else tests.push(value);
  }
  return { base, list, tests };
};

if (import.meta.main) {
  try {
    const options = reviewOptions(process.argv.slice(2));
    process.exitCode = await runLocalReview(
      resolve(import.meta.dir, "../.."),
      options.base,
      options.tests,
      options.list,
    );
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
