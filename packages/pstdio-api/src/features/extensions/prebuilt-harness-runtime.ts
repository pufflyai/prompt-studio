import { access, copyFile, mkdtemp, rm, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PreparedExtensionRevision } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import { installedDependencyHash } from "./hash-extension-dependency-inputs";
import { installDependencies, shouldInstallDependencies } from "./install-extension-dependencies";
import { copyUsableNodeModules } from "./install-extension-source-node-modules";

const nativeCommands = new Map([
  ["pstdio.harness-codex", "codex"],
  ["pstdio.harness-claude-code", "claude"],
  ["pstdio.harness-open-code", "opencode"],
]);
const metadataHandlers = new Set(["capabilities", "dispose", "recoverMessages"]);
const pending = new Map<string, Promise<void>>();

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

const reuseInstalledDependencies = async (source: string, packagePath: string, stage: string) => {
  const expected = installedDependencyHash(packagePath);
  try {
    if (installedDependencyHash(source) !== expected || shouldInstallDependencies(source)) return;
    await copyUsableNodeModules(source, stage);
    if (installedDependencyHash(source) === expected) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // An extension upgrade or removal can replace the source while a previous revision is in use.
  await rm(join(stage, "node_modules"), { recursive: true, force: true });
};

const stageDependencies = async (source: string, packagePath: string, target: string) => {
  const stage = await mkdtemp(join(dirname(packagePath), "harness-dependencies-"));
  let published = false;
  try {
    await reuseInstalledDependencies(source, packagePath, stage);
    const dependencies = join(stage, "node_modules");
    if (!(await exists(dependencies))) {
      await copyFile(join(packagePath, "package.json"), join(stage, "package.json"));
      await copyFile(join(packagePath, "bun.lock"), join(stage, "bun.lock"));
      await installDependencies(stage, { production: true });
    }

    // Publish only a complete dependency tree. Keeping the staging directory in place also
    // preserves Bun's Windows junctions and ties the tree to the revision's cache lifetime.
    try {
      await symlink(dependencies, target, "junction");
      published = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await exists(target))) throw error;
    }
  } finally {
    if (!published) await rm(stage, { recursive: true, force: true });
  }
};

const provisionDependencies = (source: string, revision: PreparedExtensionRevision) => {
  const target = join(revision.packagePath, "node_modules");
  const active = pending.get(target);
  if (active) return active;
  const provision = (async () => {
    if (!(await exists(target))) await stageDependencies(source, revision.packagePath, target);
  })()
    .catch((error: unknown) => {
      apiLogger.warn(
        { err: error, event: "harness.dependencies.install_failed", extension: revision.manifest.id },
        "Could not prepare the private CLI for the prebuilt harness",
      );
      throw error;
    })
    .finally(() => pending.delete(target));
  pending.set(target, provision);
  return provision;
};

export const preparePrebuiltHarnessRuntime = (source: string, revision: PreparedExtensionRevision) => {
  if (!revision.prebuiltRelease) return;
  const command = nativeCommands.get(revision.manifest.id);
  if (!command) return;
  let hasDependencies = false;
  return (path: readonly string[]) => {
    // Definition loading, workspace provisioning, and startup session metadata never install a CLI.
    const usesCli = path[0] === "commands" || (path[0] === "harnesses" && !metadataHandlers.has(path.at(-1) ?? ""));
    if (!usesCli || hasDependencies || Bun.which(command, { PATH: process.env.PATH })) return;
    return provisionDependencies(source, revision).then(() => {
      hasDependencies = true;
    });
  };
};
