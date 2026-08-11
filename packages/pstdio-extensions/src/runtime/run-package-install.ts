import { spawnSync } from "node:child_process";
import { createExtensionInstallEnvironment, createExtensionProcessEnvironment } from "./process-environment";

export type RunPackageInstallOptions = {
  extensionPath: string;
};

export type RunPackageInstallResult = {
  command: string;
  status: number;
  stderr: string;
  spawnError?: NodeJS.ErrnoException;
};

export const isBunOnPath = () => {
  // Pass a fresh env snapshot so spawnSync respects in-process mutations
  // (Bun's spawnSync does not pick up `process.env.PATH` changes otherwise).
  const result = spawnSync("bun", ["--version"], {
    stdio: "pipe",
    env: createExtensionProcessEnvironment(),
  });
  return result.status === 0;
};

// Prompt Studio is bun-only: extension dependencies always install with bun.
export const runPackageInstall = (options: RunPackageInstallOptions): RunPackageInstallResult => {
  const command = "bun install";

  const result = spawnSync("bun", ["install"], {
    cwd: options.extensionPath,
    stdio: "pipe",
    encoding: "utf8",
    env: createExtensionInstallEnvironment(),
  });

  return {
    command,
    status: result.status ?? -1,
    stderr: result.stderr ?? "",
    spawnError: result.error as NodeJS.ErrnoException | undefined,
  };
};
