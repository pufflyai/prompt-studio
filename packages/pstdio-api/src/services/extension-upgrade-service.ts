import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { isMarketplaceExtension } from "../features/extensions/extension-marketplace";
import { runCommand } from "../features/extensions/install-extension-dependencies";
import {
  type InstallExtensionSourceInput,
  installExtensionSource as installExtensionSourceDefault,
  PSTDIO_REPOSITORY_URL,
  resolvePstdioHome,
  toExtensionEnableInput,
} from "../features/extensions/install-extension-source";
import { compatibilityError } from "../features/extensions/project-extension-instance";
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
  resolveReleaseCommit?: (releaseRef: string) => Promise<string>;
  repoService: RepoService;
};

type UpgradeSource = {
  install_name: string;
  manifest_json?: unknown;
  source_ref: string | null;
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

const gitCommitPattern = /^[0-9a-f]{40}$/i;

const commitFromSourceRef = (source: UpgradeSource) => {
  if (!source.source_ref) return null;
  const prefix = `${PSTDIO_REPOSITORY_URL}@`;
  const suffix = `#extensions/${source.install_name}`;
  if (!source.source_ref.startsWith(prefix) || !source.source_ref.endsWith(suffix)) return null;
  const commit = source.source_ref.slice(prefix.length, -suffix.length);
  return gitCommitPattern.test(commit) ? commit.toLowerCase() : null;
};

export const resolveExtensionReleaseCommit = async (releaseRef: string, run = runCommand) => {
  if (gitCommitPattern.test(releaseRef)) return releaseRef.toLowerCase();

  const tagRef = releaseRef.startsWith("refs/") ? releaseRef : `refs/tags/${releaseRef}`;
  const branchRef = releaseRef.startsWith("refs/") ? null : `refs/heads/${releaseRef}`;
  const refs = [`${tagRef}^{}`, tagRef, ...(branchRef ? [branchRef] : [])];
  const result = await run("git", ["ls-remote", PSTDIO_REPOSITORY_URL, ...refs], { cwd: process.cwd() });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `Could not resolve ${releaseRef}`);
  }

  const commits = new Map(
    result.stdout
      .trim()
      .split("\n")
      .map((line) => line.split("\t", 2))
      .filter((entry): entry is [string, string] => entry.length === 2)
      .map(([commit, ref]) => [ref, commit]),
  );
  const commit = refs.map((ref) => commits.get(ref)).find(Boolean);
  if (!commit || !gitCommitPattern.test(commit)) throw new Error(`Could not resolve ${releaseRef}`);
  return commit.toLowerCase();
};

export const createExtensionUpgradeService = (deps: ExtensionUpgradeServiceDeps) => {
  const install = deps.installExtensionSource ?? installExtensionSourceDefault;
  const enabled = Boolean(deps.releaseRef);
  let releaseCommit: Promise<string> | undefined;
  const previewSources = new Map<string, ReturnType<typeof install>>();
  const currentReleaseCommit = () => {
    if (!deps.releaseRef) return Promise.reject(new Error("No extension release ref is configured"));
    releaseCommit ??= (deps.resolveReleaseCommit ?? resolveExtensionReleaseCommit)(deps.releaseRef);
    return releaseCommit;
  };
  // The marketplace catalog decides whether an install slot is release-managed. Stored install
  // provenance must not gate this: rows created by discovery carry none, and hiding the upgrade
  // for them would remove the only recovery path after an extension API change. A source with no
  // recorded commit is offered the release build only when the host can no longer load it — a
  // healthy source without provenance is usually a deliberate local install.
  const canUpgrade = async (source: UpgradeSource) => {
    if (!enabled || !isMarketplaceExtension(source.install_name)) return false;
    const installedCommit = commitFromSourceRef(source);
    if (!installedCommit) return compatibilityError(source) !== null;
    try {
      return installedCommit !== (await currentReleaseCommit());
    } catch {
      // Keep the recovery action available when the release ref cannot be checked yet.
      return true;
    }
  };

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
    const installed = await install({
      source: installName,
      installName,
      force: true,
      ref: deps.releaseRef,
      reuseInstalledDependencies: true,
    });
    const installedCommit =
      installed.source.kind === "named"
        ? commitFromSourceRef({
            install_name: installed.installName,
            source_ref: installed.source.ref,
          })
        : null;
    if (installedCommit) releaseCommit = Promise.resolve(installedCommit);
    return installed;
  };

  const prepareMarketplaceExtensionSource = (installName: string) => {
    assertMarketplaceInstall(installName);
    const existing = previewSources.get(installName);
    if (existing) return existing;

    const previewHome = join(
      resolvePstdioHome({ env: process.env }),
      "cache",
      "extension-catalog",
      encodeURIComponent(deps.releaseRef!),
    );
    const preview = install({
      env: { ...process.env, PSTDIO_HOME: previewHome },
      source: installName,
      installName,
      force: true,
      ref: deps.releaseRef,
      reuseInstalledDependencies: true,
    }).catch((error) => {
      if (previewSources.get(installName) === preview) previewSources.delete(installName);
      throw error;
    });
    previewSources.set(installName, preview);
    return preview;
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
    assertMarketplaceInstall(existing.installedSource.install_name);
    if (!(await canUpgrade(existing.installedSource))) {
      throw new ExtensionUpgradeUnavailableError("This extension is already up to date.");
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
    const installedCommit = commitFromSourceRef(installedSource);
    if (installedCommit) releaseCommit = Promise.resolve(installedCommit);

    return {
      changed: existing.installedSource.source_hash !== installed.sourceHash,
      instance: existing.instance,
      installedSource,
    };
  };

  return {
    canUpgrade,
    enabled,
    installMarketplaceExtension,
    prepareMarketplaceExtensionSource,
    releaseRef: deps.releaseRef,
    upgrade,
  };
};
