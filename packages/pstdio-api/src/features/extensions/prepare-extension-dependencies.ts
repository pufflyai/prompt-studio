import { existsSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { installedDependencyHash } from "./hash-extension-dependency-inputs";
import { installDependencies, shouldInstallDependencies } from "./install-extension-dependencies";
import {
  copyUsableNodeModules,
  hasLocalDirectoryDependencies,
  linkUsableNodeModules,
} from "./install-extension-source-node-modules";
import type { InstallExtensionSourceInput } from "./install-extension-source-types";

const linkInstalledDependencies = (sourcePath: string, targetPath: string, installPath: string) => {
  if (!existsSync(targetPath)) return false;
  if (installedDependencyHash(sourcePath) !== installedDependencyHash(targetPath)) return false;
  const installedNodeModules = join(targetPath, "node_modules");
  const stagedNodeModules = join(installPath, "node_modules");
  if (!existsSync(installedNodeModules) || existsSync(stagedNodeModules)) return false;
  symlinkSync(installedNodeModules, stagedNodeModules, "junction");
  return true;
};

type PreparedExtensionSource =
  | { kind: "local"; path: string; ref?: string }
  | { kind: "named"; name: string; path: string; ref: string };

export const prepareInstallDependencies = async (input: {
  installInput: InstallExtensionSourceInput;
  installPath: string;
  source: PreparedExtensionSource;
  targetPath: string;
}) => {
  const { installInput, installPath, source, targetPath } = input;
  let linkedInstalledDependencies =
    installInput.reuseInstalledDependencies || installInput.skipInstall
      ? linkInstalledDependencies(source.path, targetPath, installPath)
      : false;

  if (installInput.skipInstall && source.kind === "local") {
    linkUsableNodeModules(source.path, installPath);
  }

  if (installInput.skipInstall || !shouldInstallDependencies(installPath)) return linkedInstalledDependencies;

  if (linkedInstalledDependencies) {
    unlinkSync(join(installPath, "node_modules"));
    linkedInstalledDependencies = false;
  }
  if (source.kind === "local" && hasLocalDirectoryDependencies(source.path)) {
    // Local dependencies belong to the source checkout. Bun resolves local
    // lockfile paths relative to that checkout. See ADR 0017 for the production case.
    await installDependencies(source.path, installInput);
    await copyUsableNodeModules(source.path, installPath);
  } else {
    const releaseUpgrade = source.kind === "named" && installInput.upgradeFromVersion != null;
    await installDependencies(installPath, {
      ...installInput,
      production: releaseUpgrade || !installInput.reuseInstalledDependencies,
    });
  }
  return linkedInstalledDependencies;
};
