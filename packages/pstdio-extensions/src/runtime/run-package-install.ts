import { spawnSync } from "node:child_process";
import type { PackageManager } from "./detect-package-manager";

export type RunPackageInstallOptions = {
  extensionPath: string;
  manager: PackageManager;
};

export type RunPackageInstallResult = {
  manager: PackageManager;
  command: string;
  status: number;
  stderr: string;
  spawnError?: NodeJS.ErrnoException;
};

const installArgs: Record<PackageManager, string[]> = {
  bun: ["install"],
  npm: ["install", "--no-audit", "--no-fund"],
};

export const isPackageManagerOnPath = (manager: PackageManager) => {
  // Pass a fresh env snapshot so spawnSync respects in-process mutations
  // (Bun's spawnSync does not pick up `process.env.PATH` changes otherwise).
  const result = spawnSync(manager, ["--version"], { stdio: "pipe", env: { ...process.env } });
  return result.status === 0;
};

export const runPackageInstall = (options: RunPackageInstallOptions): RunPackageInstallResult => {
  const args = installArgs[options.manager];
  const command = `${options.manager} ${args.join(" ")}`;

  const result = spawnSync(options.manager, args, {
    cwd: options.extensionPath,
    stdio: "pipe",
    encoding: "utf8",
    env: { ...process.env },
  });

  return {
    manager: options.manager,
    command,
    status: result.status ?? -1,
    stderr: result.stderr ?? "",
    spawnError: result.error as NodeJS.ErrnoException | undefined,
  };
};
