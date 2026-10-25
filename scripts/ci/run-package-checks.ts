import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runCiChecks } from "./run-ci-checks";
import { readWorkspacePackages } from "./workspace-packages";

const mode = process.argv[2];
const filters = (process.env.LERNA_FILTER ?? "").split(/\s+/).filter(Boolean);
const scoped = filters.filter((_, index) => filters[index - 1] === "--scope");
const excluded = ["--ignore", "e2e", "--ignore", "storybook-tests"];
const lerna = ["bunx", "lerna", "run"];
const common = ["--no-bail", "--stream", "--concurrency=2", ...filters];
const checks =
  mode === "unit"
    ? [
        {
          id: "package-tests",
          command: [...lerna, "test", ...excluded, "--ignore", "pstdio-api", "--ignore", "pstdio-db", ...common],
        },
        { id: "sync-conformance", command: [...lerna, "test:conformance", ...common] },
      ]
    : [{ id: "package-lint", command: [...lerna, "lint", ...common] }];
if (mode === "unit" && (!scoped.length || scoped.includes("storybook-tests")))
  checks.push({
    id: "storybook-server-tests",
    command: ["bun", "run", "--cwd", "packages/storybook-tests", "test:scripts"],
  });
if (mode === "lint") {
  for (const pkg of readWorkspacePackages(process.cwd())) {
    if (scoped.length && !scoped.includes(pkg.name)) continue;
    const manifest = JSON.parse(readFileSync(join(pkg.dir, "package.json"), "utf8"));
    if (manifest.scripts?.typecheck && !manifest.scripts?.lint)
      checks.push({ id: `${pkg.name}:typecheck`, command: ["bun", "run", "--cwd", pkg.dir, "typecheck"] });
  }
}
if (!["unit", "lint"].includes(mode ?? "")) throw new Error("Choose unit or lint");
const result = await runCiChecks(checks, { priority: "P0", concurrency: 1 });
await Bun.write(`test-results/ci/${mode}-results.json`, JSON.stringify(result, null, 2));
process.exitCode = result.outcome === "success" ? 0 : 1;
