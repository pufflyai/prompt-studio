import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPriorityPlan } from "./priority-plan";
import { runCiChecks } from "./run-ci-checks";
import { discoverTestFiles } from "./test-discovery";
import { readWorkspacePackages } from "./workspace-packages";

const mode = process.argv[2];
if (!["unit", "lint"].includes(mode ?? "")) throw new Error("Choose unit or lint");
const root = process.cwd();
const filters = (process.env.LERNA_FILTER ?? "").split(/\s+/).filter(Boolean);
const scoped = filters.filter((_, index) => filters[index - 1] === "--scope");
const packages = readWorkspacePackages(root).map((pkg) => ({
  ...pkg,
  scripts: JSON.parse(readFileSync(join(pkg.dir, "package.json"), "utf8")).scripts ?? {},
}));
// Dependencies were built before this phase. Nx lint targets schedule dependency
// builds again, which can replace files while the independent unit checks read them.
let checks = packages.flatMap((pkg) => {
  if (scoped.length && !scoped.includes(pkg.name)) return [];
  const script = pkg.scripts.lint ? "lint" : "typecheck";
  if (!pkg.scripts[script]) return [];
  return [{ id: `${pkg.name}:${script}`, command: ["bun", "run", "--cwd", pkg.dir, script], cwd: root }];
});
if (mode === "unit") {
  const files = discoverTestFiles(root).filter((file) => !/^packages\/pstdio-(?:api|db)\//.test(file));
  checks = createPriorityPlan(files, packages, "P0", {
    runner: "bun",
    ...(scoped.length ? { scope: scoped.join(",") } : {}),
  })
    .filter((run) => run.owner !== "repository")
    .map((run) => ({ id: run.id, command: run.command, cwd: join(root, run.cwd) }));
}
const result = checks.length
  ? await runCiChecks(checks, { priority: "P0", concurrency: 2, env: { TEST_PRIORITIES: "P0" } })
  : { outcome: "success", results: [], selection: "No P0 Bun tests in these owners" };
await Bun.write(`test-results/ci/${mode}-results.json`, JSON.stringify(result, null, 2));
process.exitCode = result.outcome === "success" ? 0 : 1;
