import { existsSync, realpathSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { withFileMutationLock } from "pstdio-paths";
import { hashExtensionDependencyInputs } from "./hash-extension-dependency-inputs";
import { prepareNodeModulesRelocation } from "./install-extension-source-node-modules";

export class ExtensionAlreadyInstalledError extends Error {
  targetPath: string;

  constructor(targetPath: string) {
    super(`Installed extension already exists: ${targetPath}`);
    this.name = "ExtensionAlreadyInstalledError";
    this.targetPath = targetPath;
  }
}

export const promotePreparedSource = async (
  preparedPath: string,
  targetPath: string,
  replaceExisting: boolean,
  preserveDependencies: boolean,
) => {
  const backupPath = join(dirname(preparedPath), ".previous");
  const relocateNodeModules = await prepareNodeModulesRelocation(preparedPath, targetPath);

  // Default installs share this target across project and runtime processes. Keep the
  // entire synchronous swap and rollback under one canonical filesystem claim.
  const extensionsRoot = realpathSync.native(dirname(targetPath));
  const lockPath = join(dirname(extensionsRoot), ".extension-source-locks", basename(targetPath));
  return withFileMutationLock(lockPath, () => {
    if (existsSync(targetPath) && !replaceExisting) throw new ExtensionAlreadyInstalledError(targetPath);
    if (
      preserveDependencies &&
      (!existsSync(join(targetPath, "node_modules")) ||
        hashExtensionDependencyInputs(preparedPath) !== hashExtensionDependencyInputs(targetPath))
    ) {
      throw new Error("Installed extension dependencies changed while preparing the replacement");
    }
    if (existsSync(targetPath)) {
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
  });
};
