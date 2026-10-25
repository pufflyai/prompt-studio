import { runCiChecks } from "./run-ci-checks";

const scripts = [
  "format:check",
  "verify:boundaries",
  "verify:lockfile",
  "verify:extension-api-version",
  "validate:changesets",
  "knip",
];
const checks = [
  ...scripts.map((script) => ({ id: script, command: ["bun", "run", script] })),
  { id: "verify:translations", command: ["bun", "scripts/ci/run-translation-check.ts"] },
  ...["verify:docs-links", "verify:sdk-reference", "verify:docs-snippets"].map((script) => ({
    id: script,
    command: ["bun", "run", "--cwd", "scripts", script],
  })),
];
const result = await runCiChecks(checks, { priority: "P0", concurrency: 1 });
await Bun.write("test-results/ci/static-results.json", JSON.stringify(result, null, 2));
process.exitCode = result.outcome === "success" ? 0 : 1;
