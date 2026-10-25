import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createPriorityPlan } from "./priority-plan";
import { runCiChecks } from "./run-ci-checks";
import { discoverTestFiles } from "./test-discovery";
import type { TestPriority } from "./test-policy";
import { readWorkspacePackages } from "./workspace-packages";

const priorities: TestPriority[] = ["P0", "P1", "P2"];
// These owners have separate native database or end-to-end jobs.
const separateOwners = new Set(["pstdio-api", "pstdio-db", "e2e", "storybook-tests"]);

export const createWindowsUnitPlan = (
  files: string[],
  packages: Parameters<typeof createPriorityPlan>[1],
  shard: string,
) => {
  if (!/^[1-9]\d*\/[1-9]\d*$/.test(shard)) throw new Error(`Invalid Windows unit shard: ${shard}`);
  const [part, total] = shard.split("/").map(Number) as [number, number];
  if (part > total) throw new Error(`Invalid Windows unit shard: ${shard}`);
  const runs = priorities.flatMap((priority) => createPriorityPlan(files, packages, priority, { runner: "bun" }));
  const eligible = runs.filter((run) => !separateOwners.has(run.owner));
  // Split files before grouping by owner. Per-package Bun shards leave small
  // packages empty and cannot provide the required file/case execution evidence.
  const selected = new Set(
    eligible
      .flatMap((run) => run.files)
      .sort()
      .filter((_, index) => index % total === part - 1),
  );
  const plan = eligible.flatMap((run) => {
    const selectedFiles = run.files.filter((file) => selected.has(file));
    return createPriorityPlan(selectedFiles, packages, run.priority, { runner: "bun" }).map((selectedRun) => ({
      ...selectedRun,
      id: `${run.priority}:${selectedRun.id}`,
      command: run.owner === "pstdio-wt" ? selectedRun.command : [...selectedRun.command, "--timeout=15000"],
    }));
  });
  if (!plan.length) throw new Error(`No Windows unit tests selected for shard ${shard}`);
  return plan;
};

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../..");
  process.chdir(root);
  const shard = process.argv[2] ?? "";
  const packages = readWorkspacePackages(root).map((pkg) => ({
    ...pkg,
    scripts: JSON.parse(readFileSync(join(root, pkg.dir, "package.json"), "utf8")).scripts ?? {},
  }));
  const plan = createWindowsUnitPlan(discoverTestFiles(root), packages, shard);
  if (process.argv.includes("--list")) console.log(JSON.stringify(plan, null, 2));
  else {
    const result = await runCiChecks(
      plan.map((run) => ({ ...run, cwd: join(root, run.cwd) })),
      { priority: "P2", concurrency: 1, env: { TEST_PRIORITIES: priorities.join(",") } },
    );
    await Bun.write(
      join(root, `test-results/ci/windows-unit-${shard.replace("/", "-")}.json`),
      JSON.stringify({ shard, plan, ...result }, null, 2),
    );
    process.exitCode = result.outcome === "success" ? 0 : 1;
  }
}
