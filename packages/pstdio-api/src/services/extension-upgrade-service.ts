import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ExtensionRelease } from "../app-config";
import {
  type ExtensionCatalog,
  type ExtensionCatalogEntry,
  getExtensionCatalog,
} from "../features/extensions/extension-catalog";
import { runCommand } from "../features/extensions/install-extension-dependencies";
import {
  type InstallExtensionSourceInput,
  installExtensionSource as installExtensionSourceDefault,
  prepareGitExtensionSource,
  resolvePstdioHome,
  toExtensionEnableInput,
} from "../features/extensions/install-extension-source";
import { compatibilityError } from "../features/extensions/project-extension-instance";
import type { createExtensionService } from "./extension-service";
import type { createRepoService } from "./repo-service";

type ExtensionService = Pick<
  ReturnType<typeof createExtensionService>,
  | "enableInstalledSourceForProject"
  | "getInstalledSource"
  | "getProjectExtensionInstance"
  | "listProjectExtensionInstances"
  | "registerInstalledSource"
>;

type RepoService = Pick<ReturnType<typeof createRepoService>, "listByProject">;

type ExtensionUpgradeServiceDeps = {
  extensionService: ExtensionService;
  installExtensionSource?: (input: InstallExtensionSourceInput) => ReturnType<typeof installExtensionSourceDefault>;
  catalog?: ExtensionCatalog;
  release: ExtensionRelease | null;
  resolveReleaseCommit?: (originUrl: string, releaseRef: string) => Promise<string>;
  repoService: RepoService;
};

type UpgradeSource = {
  install_name: string;
  manifest_json?: unknown;
  source_ref: string | null;
};

type InstallExtension = (input: InstallExtensionSourceInput) => ReturnType<typeof installExtensionSourceDefault>;

const installFromRecordedOrigin = (input: {
  install: InstallExtension;
  installName: string;
  origin: { kind: "git"; url: string; path: string; ref: string };
  repoPath?: string;
}) =>
  input.install({
    source: input.installName,
    installName: input.installName,
    force: true,
    ref: input.origin.ref,
    prepareNamedSource: (_name, tempDir, ref) =>
      prepareGitExtensionSource(input.origin, tempDir, ref ?? input.origin.ref),
    ...(input.repoPath ? { repoPath: input.repoPath } : {}),
    reuseInstalledDependencies: true,
  });

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

const extensionScope = (manifest: unknown) => {
  if (!manifest || typeof manifest !== "object" || !("pstdio" in manifest)) return "user";
  const pstdio = manifest.pstdio;
  return pstdio && typeof pstdio === "object" && "scope" in pstdio && pstdio.scope === "repo" ? "repo" : "user";
};

const enableExisting = async (
  deps: ExtensionUpgradeServiceDeps,
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

const gitCommitPattern = /^[0-9a-f]{40}$/i;

export const parseExtensionSourceRef = (sourceRef: string | null) => {
  if (!sourceRef) return null;
  const pathSeparator = sourceRef.lastIndexOf("#");
  const commitSeparator = sourceRef.lastIndexOf("@", pathSeparator);
  if (pathSeparator < 1 || commitSeparator < 1) return null;
  const commit = sourceRef.slice(commitSeparator + 1, pathSeparator);
  const path = sourceRef.slice(pathSeparator + 1);
  const url = sourceRef.slice(0, commitSeparator);
  if (!url || !path || !gitCommitPattern.test(commit)) return null;
  return { commit: commit.toLowerCase(), path, url };
};

export const resolveExtensionReleaseCommit = async (originUrl: string, releaseRef: string, run = runCommand) => {
  if (gitCommitPattern.test(releaseRef)) return releaseRef.toLowerCase();

  const tagRef = releaseRef.startsWith("refs/") ? releaseRef : `refs/tags/${releaseRef}`;
  const branchRef = releaseRef.startsWith("refs/") ? null : `refs/heads/${releaseRef}`;
  const refs = [`${tagRef}^{}`, tagRef, ...(branchRef ? [branchRef] : [])];
  const result = await run("git", ["ls-remote", originUrl, ...refs], { cwd: process.cwd() });
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
  const catalog = deps.catalog ? Promise.resolve(deps.catalog) : getExtensionCatalog();
  const releaseCommits = new Map<string, Promise<string>>();
  const previewSources = new Map<string, ReturnType<typeof install>>();
  const catalogEntry = async (installName: string) =>
    (await catalog).extensions.find((entry) => entry.installName === installName);
  const releaseRefFor = (entry: ExtensionCatalogEntry) => {
    if (entry.origin.ref !== "{hostRelease}") return entry.origin.ref;
    if (deps.release) return deps.release.ref;
    throw new ExtensionUpgradeUnavailableError("This extension requires a Prompt Studio host release ref.");
  };
  const currentReleaseCommit = (originUrl: string, releaseRef: string) => {
    const key = `${originUrl}\0${releaseRef}`;
    let commit = releaseCommits.get(key);
    if (!commit) {
      commit = (deps.resolveReleaseCommit ?? resolveExtensionReleaseCommit)(originUrl, releaseRef);
      releaseCommits.set(key, commit);
    }
    return commit;
  };
  const canUpgrade = async (source: UpgradeSource) => {
    const entry = await catalogEntry(source.install_name);
    const parsed = parseExtensionSourceRef(source.source_ref);
    if (!entry && !parsed) return false;
    if (entry && parsed && (entry.origin.url !== parsed.url || entry.origin.path !== parsed.path)) return false;
    let releaseRef: string | undefined;
    try {
      releaseRef = entry ? releaseRefFor(entry) : deps.release?.ref;
    } catch {
      return false;
    }
    if (!parsed) return compatibilityError(source) !== null;
    if (!releaseRef) return false;
    try {
      return parsed.commit !== (await currentReleaseCommit(parsed.url, releaseRef));
    } catch {
      // Keep the recovery action available when the release ref cannot be checked yet.
      return true;
    }
  };

  const requireCatalogEntry = async (installName: string) => {
    const entry = await catalogEntry(installName);
    if (!entry) throw new ExtensionUpgradeUnavailableError(`No catalog entry for extension: ${installName}`);
    releaseRefFor(entry);
    return entry;
  };

  const installForRelease = async (installName: string, repoPath?: string) => {
    const entry = await requireCatalogEntry(installName);
    const workspaceSource = deps.release?.source === "workspace" && entry.origin.ref === "{hostRelease}";
    const source =
      workspaceSource && deps.release?.source === "workspace"
        ? join(deps.release.root, entry.origin.path)
        : installName;
    const installed = await install({
      source,
      installName,
      force: true,
      ...(workspaceSource ? { skipInstall: true } : { hostReleaseRef: deps.release?.ref }),
      ...(repoPath ? { repoPath } : {}),
      reuseInstalledDependencies: true,
    });
    const installedOrigin = installed.source.kind === "named" ? parseExtensionSourceRef(installed.source.ref) : null;
    if (installedOrigin) {
      releaseCommits.set(`${installedOrigin.url}\0${releaseRefFor(entry)}`, Promise.resolve(installedOrigin.commit));
    }
    return installed;
  };

  const prepareMarketplaceExtensionSource = async (installName: string) => {
    const entry = await requireCatalogEntry(installName);
    const existing = previewSources.get(installName);
    if (existing) return existing;

    const releaseRef = releaseRefFor(entry);
    const previewHome = join(
      resolvePstdioHome({ env: process.env }),
      "cache",
      "extension-catalog",
      encodeURIComponent(`${entry.origin.url}@${releaseRef}`),
    );
    const workspaceSource = deps.release?.source === "workspace" && entry.origin.ref === "{hostRelease}";
    const source =
      workspaceSource && deps.release?.source === "workspace"
        ? join(deps.release.root, entry.origin.path)
        : installName;
    const preview = install({
      env: { ...process.env, PSTDIO_HOME: previewHome },
      source,
      installName,
      force: true,
      ...(workspaceSource ? { skipInstall: true } : { hostReleaseRef: deps.release?.ref }),
      repoPath: join(previewHome, "repo"),
      reuseInstalledDependencies: true,
    }).catch((error) => {
      if (previewSources.get(installName) === preview) previewSources.delete(installName);
      throw error;
    });
    previewSources.set(installName, preview);
    return preview;
  };

  const installMarketplaceExtension = async (projectId: string, installName: string) => {
    const requestedEntry = await requireCatalogEntry(installName);
    const repos = [...(await deps.repoService.listByProject(projectId))].sort((left, right) =>
      left.path.localeCompare(right.path),
    );
    const records = await deps.extensionService.listProjectExtensionInstances(projectId);
    const knownRepoScope = records.some(
      (record) =>
        record.installedSource.install_name === installName &&
        extensionScope(record.installedSource.manifest_json) === "repo",
    );

    const installRepoCopies = async (firstInstalled?: Awaited<ReturnType<typeof installForRelease>>) => {
      if (repos.length === 0) {
        throw new ExtensionUpgradeUnavailableError("Link a repository before installing this repo-scoped extension.");
      }
      const installedResults = [];
      for (const [index, repo] of repos.entries()) {
        const targetPath = resolve(repo.path, ".pstdio/extensions", installName);
        const existing = records.find(
          (record) => resolve(record.installedSource.source_path) === targetPath && existsSync(targetPath),
        );
        if (existing) {
          installedResults.push(await enableExisting(deps, projectId, existing.installedSource));
          continue;
        }

        const installed =
          index === 0 && firstInstalled ? firstInstalled : await installForRelease(installName, repo.path);
        installedResults.push(
          await deps.extensionService.enableInstalledSourceForProject({
            installName: installed.installName,
            projectId,
            ...toExtensionEnableInput(installed),
          }),
        );
      }
      return installedResults[0]!;
    };

    if (knownRepoScope) return installRepoCopies();

    const existing = await deps.extensionService.getInstalledSource(installName);
    const existingOrigin = parseExtensionSourceRef(existing?.source_ref ?? null);
    if (
      existingOrigin &&
      (existingOrigin.url !== requestedEntry.origin.url || existingOrigin.path !== requestedEntry.origin.path)
    ) {
      throw new ExtensionUpgradeUnavailableError(
        `Extension ${installName} is already installed from ${existingOrigin.url}#${existingOrigin.path}`,
      );
    }
    if (
      existing &&
      extensionScope(existing.manifest_json) === "user" &&
      existsSync(join(existing.source_path, "package.json"))
    ) {
      return enableExisting(deps, projectId, existing);
    }

    let installed: Awaited<ReturnType<typeof installForRelease>>;
    try {
      installed = await installForRelease(installName, repos[0]?.path);
    } catch (error) {
      if (error instanceof Error && error.message.includes("must be installed from a linked repo")) {
        throw new ExtensionUpgradeUnavailableError("Link a repository before installing this repo-scoped extension.");
      }
      throw error;
    }
    if (extensionScope(installed.manifest) === "repo") return installRepoCopies(installed);

    return deps.extensionService.enableInstalledSourceForProject({
      installName: installed.installName,
      projectId,
      ...toExtensionEnableInput(installed),
    });
  };

  const upgrade = async (projectId: string, instanceId: string) => {
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return null;
    if (!(await canUpgrade(existing.installedSource))) {
      throw new ExtensionUpgradeUnavailableError("This extension is already up to date.");
    }

    const repoPath = await repoForSource(deps, projectId, existing.installedSource.source_path);
    const entry = await catalogEntry(existing.installedSource.install_name);
    const parsed = parseExtensionSourceRef(existing.installedSource.source_ref);
    let installed: Awaited<ReturnType<typeof install>>;
    if (entry) {
      installed = await installForRelease(existing.installedSource.install_name, repoPath);
    } else if (parsed && deps.release?.ref) {
      const origin = { kind: "git" as const, url: parsed.url, path: parsed.path, ref: deps.release.ref };
      installed = await installFromRecordedOrigin({
        install,
        installName: existing.installedSource.install_name,
        origin,
        repoPath,
      });
    } else {
      throw new ExtensionUpgradeUnavailableError(
        `No upgrade origin for extension: ${existing.installedSource.install_name}`,
      );
    }
    const installedSource = await deps.extensionService.registerInstalledSource({
      installName: installed.installName,
      ...toExtensionEnableInput(installed),
    });
    const installedOrigin = parseExtensionSourceRef(installedSource.source_ref);
    if (installedOrigin) {
      const releaseRef = entry ? releaseRefFor(entry) : deps.release?.ref;
      if (releaseRef) {
        releaseCommits.set(`${installedOrigin.url}\0${releaseRef}`, Promise.resolve(installedOrigin.commit));
      }
    }

    return {
      changed: existing.installedSource.source_hash !== installed.sourceHash,
      instance: existing.instance,
      installedSource,
    };
  };

  return {
    canUpgrade,
    enabled: true,
    installMarketplaceExtension,
    prepareMarketplaceExtensionSource,
    releaseRef: deps.release?.ref,
    upgrade,
  };
};
