import type { TestPriority } from "./test-policy";
import { createTestRuns } from "./test-runs";

const priorities: TestPriority[] = ["P0", "P1", "P2"];
// These owners have separate native database or end-to-end jobs.
const separateOwners = new Set(["pstdio-api", "pstdio-db", "e2e", "canvas-tests"]);

export const createWindowsUnitPlan = (
  files: string[],
  packages: Parameters<typeof createTestRuns>[1],
  shard: string,
) => {
  if (!/^[1-9]\d*\/[1-9]\d*$/.test(shard)) throw new Error(`Invalid Windows unit shard: ${shard}`);
  const [part, total] = shard.split("/").map(Number) as [number, number];
  if (part > total) throw new Error(`Invalid Windows unit shard: ${shard}`);
  const runs = priorities.flatMap((priority) => createTestRuns(files, packages, priority, { runner: "bun" }));
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
    return createTestRuns(selectedFiles, packages, run.priority, { runner: "bun" }).map((selectedRun) => ({
      ...selectedRun,
      id: `${run.priority}:${selectedRun.id}`,
      command: run.owner === "pstdio-wt" ? selectedRun.command : [...selectedRun.command, "--timeout=15000"],
    }));
  });
  if (!plan.length) throw new Error(`No Windows unit tests selected for shard ${shard}`);
  return plan;
};
