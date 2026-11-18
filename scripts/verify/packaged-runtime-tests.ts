import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { readTestPriorities } from "../ci/test-discovery";

interface PackagedRuntimeTestInput {
  cwd: string;
  binaryPath: string;
  shard?: string;
}

export const runPackagedRuntimeTests = (input: PackagedRuntimeTestInput) => {
  const args = process.env.CI_PLAN_JOB
    ? [
        resolve(import.meta.dirname, "../test.ts"),
        "--plan",
        resolve("test-results/ci/plan.json"),
        "--job",
        process.env.CI_PLAN_JOB,
        "--prebuilt",
      ]
    : [
        resolve(input.cwd, "../../scripts/test.ts"),
        "--artifact",
        "compiled-cli",
        "--prebuilt",
        ...(process.env.TEST_PRIORITIES === undefined ? [] : ["--priority", readTestPriorities().join(",")]),
        ...(input.shard === undefined ? [] : ["--shard", input.shard]),
      ];
  const result = spawnSync("bun", args, {
    cwd: input.cwd,
    stdio: "inherit",
    env: { ...process.env, E2E_PACKAGED_BINARY_PATH: input.binaryPath },
  });
  if (result.status !== 0) throw new Error(`Packaged e2e failed (${result.status})`);
};
