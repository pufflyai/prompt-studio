import { join, resolve } from "node:path";
import type { ExtensionRelease } from "../app-config";
import {
  type ExtensionCatalog,
  type ExtensionCatalogEntry,
  getExtensionCatalog,
} from "../features/extensions/extension-catalog";
import {
  type InstallExtensionSourceInput,
  installExtensionSource as installExtensionSourceDefault,
  prepareGitExtensionSource,
  resolvePstdioHome,
  toExtensionEnableInput,
} from "../features/extensions/install-extension-source";
import { compatibilityError } from "../features/extensions/project-extension-instance";
import { createMarketplaceExtensionInstaller } from "./extension-marketplace-install";
import type { createExtensionService } from "./extension-service";
import { parseExtensionSourceRef, resolveExtensionReleaseCommit } from "./extension-source-ref";
import { ExtensionUpgradeUnavailableError } from "./extension-upgrade-unavailable-error";

export type ExtensionService = Pick<
  ReturnType<typeof createExtensionService>,
  | "enableInstalledSourceForProject"
  | "getInstalledSource"
  | "getProjectExtensionInstance"
  | "listProjectExtensionInstances"
  | "registerInstalledSource"
>;

type WorkspaceService = { getDefault(projectId: string): Promise<{ root_path: string | null } | null> };

export type ExtensionUpgradeServiceDeps = {
  extensionService: ExtensionService;
  installExtensionSource?: (input: InstallExtensionSourceInput) => ReturnType<typeof installExtensionSourceDefault>;
  catalog?: ExtensionCatalog;
  release: ExtensionRelease | null;
  resolveReleaseCommit?: (originUrl: string, releaseRef: string) => Promise<string>;
  workspaceService: WorkspaceService;
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

const repoForSource = async (deps: ExtensionUpgradeServiceDeps, projectId: string, sourcePath: string) => {
  const workspace = await deps.workspaceService.getDefault(projectId);
  const root = workspace?.root_path;
  return root && resolve(root, ".pstdio/extensions") === resolve(sourcePath, "..") ? root : undefined;
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

  const installMarketplaceExtension = createMarketplaceExtensionInstaller({
    deps,
    installForRelease,
    requireCatalogEntry,
  });

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
