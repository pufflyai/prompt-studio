import { resolve } from "node:path";
import {
  type InstallExtensionSourceInput,
  installExtensionSource as installExtensionSourceDefault,
  toExtensionEnableInput,
} from "../features/extensions/install-extension-source";
import type { createExtensionService } from "./extension-service";
import type { createRepoService } from "./repo-service";

type ExtensionService = Pick<
  ReturnType<typeof createExtensionService>,
  "getProjectExtensionInstance" | "registerInstalledSource"
>;

type RepoService = Pick<ReturnType<typeof createRepoService>, "listByProject">;

type ExtensionUpgradeServiceDeps = {
  extensionService: ExtensionService;
  installExtensionSource?: (input: InstallExtensionSourceInput) => ReturnType<typeof installExtensionSourceDefault>;
  releaseRef?: string;
  repoService: RepoService;
};

export class ExtensionUpgradeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtensionUpgradeUnavailableError";
  }
}

const repoForSource = async (deps: ExtensionUpgradeServiceDeps, projectId: string, sourcePath: string) => {
  const repos = await deps.repoService.listByProject(projectId);
  return repos.find((repo) => resolve(repo.path, ".pstdio/extensions") === resolve(sourcePath, ".."))?.path;
};

export const createExtensionUpgradeService = (deps: ExtensionUpgradeServiceDeps) => {
  const install = deps.installExtensionSource ?? installExtensionSourceDefault;
  const enabled = Boolean(deps.releaseRef);
  const canUpgrade = (source: { source_kind: string }) => enabled && source.source_kind === "git";

  const upgrade = async (projectId: string, instanceId: string) => {
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return null;
    if (!deps.releaseRef) {
      throw new ExtensionUpgradeUnavailableError("This Prompt Studio host does not provide a release extension ref.");
    }
    if (!canUpgrade(existing.installedSource)) {
      throw new ExtensionUpgradeUnavailableError("Only release-managed Git extensions can be upgraded.");
    }

    const repoPath = await repoForSource(deps, projectId, existing.installedSource.source_path);
    const installed = await install({
      source: existing.installedSource.install_name,
      installName: existing.installedSource.install_name,
      force: true,
      ref: deps.releaseRef,
      reuseInstalledDependencies: true,
      ...(repoPath ? { repoPath } : {}),
    });
    const installedSource = await deps.extensionService.registerInstalledSource({
      installName: installed.installName,
      ...toExtensionEnableInput(installed),
    });

    return {
      changed: existing.installedSource.source_hash !== installed.sourceHash,
      instance: existing.instance,
      installedSource,
    };
  };

  return { canUpgrade, enabled, upgrade };
};
