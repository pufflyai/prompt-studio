import { existsSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { prepareNodeModulesRelocation } from "./install-extension-source-node-modules";

export class ExtensionAlreadyInstalledError extends Error {
  targetPath: string;

  constructor(targetPath: string) {
    super(`Installed extension already exists: ${targetPath}`);
    this.name = "ExtensionAlreadyInstalledError";
    this.targetPath = targetPath;
  }
}

export const promotePreparedSource = (
  preparedPath: string,
  targetPath: string,
  replaceExisting: boolean,
  preserveDependencies: boolean,
) => {
  const backupPath = join(dirname(preparedPath), ".previous");
  const relocateNodeModules = prepareNodeModulesRelocation(preparedPath, targetPath);

  if (existsSync(targetPath)) {
    if (!replaceExisting) throw new ExtensionAlreadyInstalledError(targetPath);
    renameSync(targetPath, backupPath);
  }

  try {
    renameSync(preparedPath, targetPath);
    relocateNodeModules();
    const previousNodeModules = join(backupPath, "node_modules");
    if (preserveDependencies && existsSync(previousNodeModules)) {
      renameSync(previousNodeModules, join(targetPath, "node_modules"));
    }
  } catch (error) {
    try {
      rmSync(targetPath, { recursive: true, force: true });
    } catch {}
    if (existsSync(backupPath)) renameSync(backupPath, targetPath);
    throw error;
  }
};
