import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { captureOrderedPerformanceReport } from "./ordered-performance-reports";
import { performanceChecks } from "./production-performance-profile";
import { runCiChecks } from "./run-ci-checks";

// Native suite lifecycles own fixed workloads, cold-start ordering, and quarantine classification.
const root = resolve(import.meta.dir, "../..");
const [suite, directory] = process.argv.slice(2);
if (!suite || !directory) throw new Error("Expected benchmark suite and evidence directory");
const sha = process.env.CI_PLAN_SOURCE_SHA!;
const cache = join(process.env.RUNNER_TEMP ?? directory, "benchmarks");
const performance = join(directory, "performance");
mkdirSync(performance, { recursive: true });
const fixedWorkload = suite === "subnav" || suite === "planner";
const command = fixedWorkload
  ? ["bun", "packages/benchmarks/src/cli.ts", "prepare", "--suites", suite, "--sha", sha, "--cache", cache]
  : [
      "bun",
      "packages/benchmarks/src/cli.ts",
      "run",
      "--checkout",
      `${root}=${sha}=planned-tests`,
      "--suites",
      suite,
      "--samples",
      "1",
      "--cache",
      cache,
      "--out",
      performance,
    ];
let result = await runCiChecks([{ id: `benchmark-${suite}`, cwd: root, command }], {
  priority: "P3",
  concurrency: 1,
  inheritProcessGroup: true,
});
let complete = false;
if (suite === "subnav" && result.outcome === "success") {
  result = await runCiChecks(
    [{ id: "ordered-navigation", cwd: root, command: ["bun", "scripts/ci/run-subnav-benchmarks.ts"] }],
    {
      priority: "P3",
      concurrency: 1,
      inheritProcessGroup: true,
      env: { BENCHMARK_SAMPLES: "30", PSTDIO_EXTENSION_RELEASE_REF: sha, SUBNAV_LABEL: sha },
    },
  );
  const raw = join(root, "__test-tmp__/subnav-benchmark/results", sha);
  if (existsSync(raw)) cpSync(raw, join(performance, "subnav"), { recursive: true });
  captureOrderedPerformanceReport(root, directory, "sidenav-subnav");
  complete = result.results.every((entry) => entry.exitCode !== null);
} else if (suite === "planner" && result.outcome === "success") {
  const output = join(performance, "planner.jsonl");
  await Bun.write(output, "");
  result = await runCiChecks([performanceChecks("planner").find((check) => check.id === "planner-cold-open")!], {
    priority: "P3",
    concurrency: 1,
    inheritProcessGroup: true,
    env: { BENCHMARK_SAMPLES: "3", BENCHMARK_RESULTS: output },
    logDirectory: join(directory, "planner-logs"),
  });
  complete = result.results.every((entry) => entry.exitCode !== null);
} else if (!fixedWorkload) {
  try {
    const report = JSON.parse(
      readFileSync(join(performance, `${sha}-${process.platform}-${process.arch}.json`), "utf8"),
    );
    complete =
      report.commit.sha === sha &&
      report.suites.some((entry: { id: string }) => entry.id === suite) &&
      report.metrics.length > 0;
  } catch {
    complete = false;
  }
  if (suite === "desktop") captureOrderedPerformanceReport(root, directory, "desktop");
  if (suite === "workbench") captureOrderedPerformanceReport(root, directory, "frontend");
}
await Bun.write(
  join(directory, "lifecycle.json"),
  JSON.stringify({
    planDigest: process.env.CI_PLAN_DIGEST,
    runId: process.env.CI_PLAN_RUN_ID,
    executionId: process.env.CI_TEST_EXECUTION_ID,
    files: JSON.parse(process.env.CI_PLAN_RUN_FILES!),
    complete,
    outcome: result.outcome,
  }),
);
process.exitCode = result.outcome === "success" && complete ? 0 : 1;
