import { existsSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
const readPreviousOwner = (ownerPath: string) => {
  try {
    return readFileSync(ownerPath, "utf8");
  } catch {
    return null;
  }
};

const assertReusableDependencies = (prepared: string, target: string, preserve: boolean) => {
  if (
    preserve &&
    (!existsSync(join(target, "node_modules")) ||
      hashExtensionDependencyInputs(prepared) !== hashExtensionDependencyInputs(target))
  )
    throw new Error("Installed extension dependencies changed while preparing the replacement");
};

export const promotePreparedSource = async (
  preparedPath: string,
  targetPath: string,
  replaceExisting: boolean,
  preserveDependencies: boolean,
  onClaim?: (ownership: { ownerPath: string; token: string; previousToken: string | null }) => void,
) => {
  const backupPath = join(dirname(preparedPath), ".previous");
  const relocateNodeModules = await prepareNodeModulesRelocation(preparedPath, targetPath);

  // Default installs share this target across project and runtime processes. Keep the
  // entire synchronous swap and rollback under one canonical filesystem claim.
  const extensionsRoot = realpathSync.native(dirname(targetPath));
  const lockPath = join(dirname(extensionsRoot), ".extension-source-locks", basename(targetPath));
  return withFileMutationLock(lockPath, () => {
    const ownerPath = `${lockPath}.owner`;
    const previousToken = readPreviousOwner(ownerPath);
    const token = crypto.randomUUID();
    if (existsSync(targetPath) && !replaceExisting) throw new ExtensionAlreadyInstalledError(targetPath);
    assertReusableDependencies(preparedPath, targetPath, preserveDependencies);
    onClaim?.({ ownerPath, token, previousToken });
    writeFileSync(ownerPath, token);
    try {
      if (existsSync(targetPath)) renameSync(targetPath, backupPath);
      renameSync(preparedPath, targetPath);
      relocateNodeModules();
      const previousNodeModules = join(backupPath, "node_modules");
      if (preserveDependencies && existsSync(previousNodeModules)) {
        renameSync(previousNodeModules, join(targetPath, "node_modules"));
      }
      return { ownerPath, token, previousToken };
    } catch (error) {
      try {
        rmSync(targetPath, { recursive: true, force: true });
      } catch {}
      if (existsSync(backupPath)) renameSync(backupPath, targetPath);
      if (previousToken) writeFileSync(ownerPath, previousToken);
      else rmSync(ownerPath, { force: true });
      throw error;
    }
  });
};
