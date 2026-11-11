import { cpSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runCiChecks } from "./run-ci-checks";

// Native suite lifecycles own fixed workloads, cold-start ordering, and quarantine classification.
const root = resolve(import.meta.dir, "../..");
const [suite, directory] = process.argv.slice(2);
if (!suite || !directory) throw new Error("Expected benchmark suite and evidence directory");
const sha = process.env.CI_PLAN_SOURCE_SHA!;
const cache = join(process.env.RUNNER_TEMP ?? directory, "benchmarks");
const performance = join(directory, "performance");
const command =
  suite === "subnav"
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
  const report = join(root, "packages/e2e/test-results/subnav-benchmarks.json");
  if (existsSync(report)) {
    const execution = JSON.parse(readFileSync(report, "utf8"));
    execution.config.rootDir = "packages/e2e";
    await Bun.write(join(performance, "subnav/browser-report.json"), JSON.stringify(execution));
  }
  complete = existsSync(report) && result.results.every((entry) => entry.exitCode !== null);
} else if (suite !== "subnav") {
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
