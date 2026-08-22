import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { isMarketplaceExtension } from "../features/extensions/extension-marketplace";
import {
  type InstallExtensionSourceInput,
  installExtensionSource as installExtensionSourceDefault,
  toExtensionEnableInput,
} from "../features/extensions/install-extension-source";
import type { createExtensionService } from "./extension-service";
import type { createRepoService } from "./repo-service";

type ExtensionService = Pick<
  ReturnType<typeof createExtensionService>,
  "enableInstalledSourceForProject" | "getInstalledSource" | "getProjectExtensionInstance" | "registerInstalledSource"
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
  const canUpgrade = (source: { install_name: string; source_kind: string }) =>
    enabled && source.source_kind === "git" && isMarketplaceExtension(source.install_name);

  const assertMarketplaceInstall = (installName: string) => {
    if (!deps.releaseRef) {
      throw new ExtensionUpgradeUnavailableError("This Prompt Studio host does not provide a release extension ref.");
    }
    if (!isMarketplaceExtension(installName)) {
      throw new ExtensionUpgradeUnavailableError(
        `Extension is not available in the Prompt Studio marketplace: ${installName}`,
      );
    }
  };

  const enableExisting = async (
    projectId: string,
    source: NonNullable<Awaited<ReturnType<ExtensionService["getInstalledSource"]>>>,
  ) => {
    const manifest = (source.manifest_json ?? {}) as Record<string, unknown>;
    const name = typeof manifest.name === "string" ? manifest.name : source.install_name;
    return deps.extensionService.enableInstalledSourceForProject({
      displayName: source.display_name,
      extensionId: source.extension_id,
      installName: source.install_name,
      manifest,
      name,
      projectId,
      sourceHash: source.source_hash,
      sourceKind: source.source_kind as "git" | "local_path" | "registry",
      sourcePath: source.source_path,
      sourceRef: source.source_ref,
      version: source.version,
    });
  };

  const installForRelease = async (installName: string) => {
    assertMarketplaceInstall(installName);
    return install({
      source: installName,
      installName,
      force: true,
      ref: deps.releaseRef,
      reuseInstalledDependencies: true,
    });
  };

  const installMarketplaceExtension = async (projectId: string, installName: string) => {
    assertMarketplaceInstall(installName);
    const existing = await deps.extensionService.getInstalledSource(installName);
    if (existing && existsSync(join(existing.source_path, "package.json"))) {
      return enableExisting(projectId, existing);
    }

    const installed = await installForRelease(installName);
    return deps.extensionService.enableInstalledSourceForProject({
      installName: installed.installName,
      projectId,
      ...toExtensionEnableInput(installed),
    });
  };

  const upgrade = async (projectId: string, instanceId: string) => {
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return null;
    if (!deps.releaseRef)
      throw new ExtensionUpgradeUnavailableError("This Prompt Studio host does not provide a release extension ref.");
    if (!canUpgrade(existing.installedSource)) {
      throw new ExtensionUpgradeUnavailableError("Only Git-backed marketplace extensions can be upgraded.");
    }

    const repoPath = await repoForSource(deps, projectId, existing.installedSource.source_path);
    const installed = repoPath
      ? await install({
          source: existing.installedSource.install_name,
          installName: existing.installedSource.install_name,
          force: true,
          ref: deps.releaseRef,
          reuseInstalledDependencies: true,
          repoPath,
        })
      : await installForRelease(existing.installedSource.install_name);
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

  return { canUpgrade, enabled, installMarketplaceExtension, releaseRef: deps.releaseRef, upgrade };
};
