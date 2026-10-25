import { join } from "node:path";
import { runCiChecks } from "./run-ci-checks";

const checks = ["lint", "unit"].map((mode) => ({
  id: mode,
  command: [process.execPath, join(import.meta.dir, "run-package-checks.ts"), mode],
}));
// Instrumented source tests must not compete with lint's own workers on the
// same runner. PR and queue checks keep their existing parallel execution.
const result = await runCiChecks(checks, {
  priority: "P0",
  concurrency: process.env.CI_SOURCE_COVERAGE === "1" ? 1 : 2,
});
await Bun.write("test-results/ci/package-results.json", JSON.stringify(result, null, 2));
process.exitCode = result.outcome === "success" ? 0 : 1;
