import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { runCiChecks } from "./run-ci-checks";

const root = resolve(import.meta.dir, "../..");
const [suite, directory] = process.argv.slice(2);
if (!suite || !directory) throw new Error("Expected scenario and evidence directory");
const performance = join(directory, "performance");
mkdirSync(performance, { recursive: true });
const result = await runCiChecks(
  [
    {
      id: suite,
      cwd: root,
      command: [
        "bun",
        "packages/benchmarks/src/cli.ts",
        "run",
        "--checkout",
        `${root}=${process.env.CI_PLAN_SOURCE_SHA}=planned-tests`,
        "--suites",
        suite,
        "--samples",
        "1",
        "--out",
        performance,
      ],
    },
  ],
  {
    priority: "P3",
    concurrency: 1,
    inheritProcessGroup: true,
    env: { BENCHMARK_EVIDENCE_DIR: performance },
  },
);
await Bun.write(
  join(directory, "lifecycle.json"),
  JSON.stringify({
    planDigest: process.env.CI_PLAN_DIGEST,
    runId: process.env.CI_PLAN_RUN_ID,
    executionId: process.env.CI_TEST_EXECUTION_ID,
    files: JSON.parse(process.env.CI_PLAN_RUN_FILES!),
    complete: result.results.every((entry) => entry.exitCode !== null),
    outcome: result.outcome,
  }),
);
process.exitCode = result.outcome === "success" ? 0 : 1;
