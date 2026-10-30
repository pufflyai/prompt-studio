import { spawnSync } from "node:child_process";

interface PackagedRuntimeTestInput {
  cwd: string;
  binaryPath: string;
  shard?: string;
}

export const runPackagedRuntimeTests = (input: PackagedRuntimeTestInput) => {
  const args = ["run", "test:packaged:cli", ...(input.shard === undefined ? [] : [`--shard=${input.shard}`])];
  const result = spawnSync("bun", args, {
    cwd: input.cwd,
    stdio: "inherit",
    env: { ...process.env, E2E_PACKAGED_BINARY_PATH: input.binaryPath },
  });
  if (result.status !== 0) throw new Error(`Packaged e2e failed (${result.status})`);
};
