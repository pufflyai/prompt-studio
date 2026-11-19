import { join } from "node:path";
import { runCiChecks } from "./run-ci-checks";

const checks = ["lint", "unit"].map((mode) => ({
  id: mode,
  command:
    mode === "unit"
      ? [
          process.execPath,
          "scripts/test.ts",
          "--plan",
          "test-results/ci/plan.json",
          "--job",
          process.env.CI_PLAN_JOB!,
          "--prebuilt",
        ]
      : [process.execPath, join(import.meta.dir, "run-package-checks.ts"), "lint"],
}));
// Lint already owns two type-check workers. Finish it before unit tests so
// native readiness and file-I/O checks do not share those workers' CPU and disk.
const result = await runCiChecks(checks, {
  priority: "P0",
  concurrency: 1,
});
await Bun.write("test-results/ci/package-results.json", JSON.stringify(result, null, 2));
process.exitCode = result.outcome === "success" ? 0 : 1;
