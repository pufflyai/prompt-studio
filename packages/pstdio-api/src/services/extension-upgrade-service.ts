import { join, resolve } from "node:path";
import { GitUnavailableError, isGitAvailable } from "pstdio-wt";
import type { ExtensionRelease } from "../app-config";
import { findBundledExtensionSource } from "../features/extensions/bundled-extension-source";
import {
  type ExtensionCatalog,
  type ExtensionCatalogEntry,
  getExtensionCatalog,
  selectExtensionCatalogEntry,
} from "../features/extensions/extension-catalog";
import {
  type InstallExtensionSourceInput,
  installExtensionSource as installExtensionSourceDefault,
  resolvePstdioHome,
  toExtensionEnableInput,
} from "../features/extensions/install-extension-source";
import { compatibilityError } from "../features/extensions/project-extension-instance";
import type { createExtensionService } from "./extension-service";
import { createExtensionSourceInstaller } from "./extension-source-installer";
import { parseExtensionSourceRef, resolveExtensionReleaseCommit } from "./extension-source-ref";
import { ExtensionUpgradeUnavailableError } from "./extension-upgrade-unavailable-error";
import { createRegistryExtensionSource } from "./registry-extension-source";

export type ExtensionService = Pick<
  ReturnType<typeof createExtensionService>,
  | "enableInstalledSourceForProject"
  | "getInstalledSource"
  | "getProjectExtensionInstance"
  | "listProjectExtensionInstances"
  | "registerInstalledSource"
>;

type WorkspaceService = {
  getDefault(projectId: string): Promise<{ root_path: string | null; execution_kind?: string } | null>;
};

export type ExtensionUpgradeServiceDeps = {
  extensionService: ExtensionService;
  installExtensionSource?: (input: InstallExtensionSourceInput) => ReturnType<typeof installExtensionSourceDefault>;
  catalog?: ExtensionCatalog;
  release: ExtensionRelease | null;
  resolveReleaseCommit?: (originUrl: string, releaseRef: string, sourcePath: string) => Promise<string>;
  workspaceService: WorkspaceService;
};

type UpgradeSource = {
  install_name: string;
  manifest_json?: unknown;
  source_ref: string | null;
  source_kind?: string;
  version?: string | null;
};

type InstallExtension = (input: InstallExtensionSourceInput) => ReturnType<typeof installExtensionSourceDefault>;

const installFromRecordedOrigin = (input: {
  install: InstallExtension;
  installName: string;
  origin: { url: string; path: string };
  hostReleaseRef: string;
  identity: string;
  upgradeFromVersion: string | null;
  installedSourcePath: string;
  repoPath?: string;
}) =>
  input.install({
    source: input.installName,
    installName: input.installName,
    installedSourcePath: input.installedSourcePath,
    upgradeFromVersion: input.upgradeFromVersion,
    force: true,
    retainBackup: true,
    ref: input.hostReleaseRef,
    hostReleaseRef: input.hostReleaseRef,
    ...(input.origin.url.startsWith("https:") ? { expectedIdentity: input.identity } : {}),
    originSource: { kind: "release", origin: { kind: "git", ...input.origin, ref: input.hostReleaseRef } },
    ...(input.repoPath ? { repoPath: input.repoPath } : {}),
    reuseInstalledDependencies: true,
  });

type InstalledSource = NonNullable<Awaited<ReturnType<ExtensionService["getInstalledSource"]>>>;
const projectUpgrade =
  (
    deps: ExtensionUpgradeServiceDeps,
    replace: (
      source: InstalledSource,
      repoPath?: string,
    ) => Promise<{ changed: boolean; installedSource: InstalledSource }>,
  ) =>
  async (projectId: string, instanceId: string) => {
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return null;
    const workspace = await deps.workspaceService.getDefault(projectId);
    const root = workspace?.root_path;
    const repo =
      root && resolve(root, ".pstdio/extensions") === resolve(existing.installedSource.source_path, "..")
        ? root
        : undefined;
    return { ...(await replace(existing.installedSource, repo)), instance: existing.instance };
  };
const matchesCatalogOrigin = (
  entry: ExtensionCatalogEntry | undefined,
  source: ReturnType<typeof parseExtensionSourceRef>,
) => !entry || !source || (entry.origin.url === source.url && entry.origin.path === source.path);

/** Retired host extension folders and the catalog extension that adopts their projects. */
const retiredHostFolders = new Map([["extensions/git-workspaces", "pstdio.workspaces"]]);
const repositoryKey = (url: string) =>
  url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .toLowerCase();

// A host folder a newer release merged into another tool has no source at that release.
// Its successor's adoption replaces it, so it never offers an upgrade.
const isRetiredHostSource = (catalog: ExtensionCatalog, parsed: ReturnType<typeof parseExtensionSourceRef>) => {
  const successor = parsed && retiredHostFolders.get(parsed.path);
  if (!successor) return false;
  const entry = selectExtensionCatalogEntry(catalog, successor);
  return Boolean(entry && repositoryKey(entry.origin.url) === repositoryKey(parsed.url));
};

const upgradableOrigin = (
  catalog: ExtensionCatalog,
  entry: ExtensionCatalogEntry | undefined,
  parsed: ReturnType<typeof parseExtensionSourceRef>,
) => matchesCatalogOrigin(entry, parsed) && !isRetiredHostSource(catalog, parsed);

const upgradeRef = (entry: ExtensionCatalogEntry | undefined, release: ExtensionRelease | null) =>
  entry && entry.origin.ref !== "{hostRelease}" ? entry.origin.ref : release?.ref;

const releaseCommitKey = (origin: { url: string; path: string }, ref: string) =>
  `${origin.url}\0${origin.path}\0${ref}`;

export const createExtensionUpgradeService = (deps: ExtensionUpgradeServiceDeps) => {
  const install = deps.installExtensionSource ?? installExtensionSourceDefault;
  const registry = createRegistryExtensionSource(deps, install);
  const catalog = deps.catalog ? Promise.resolve(deps.catalog) : getExtensionCatalog();
  const releaseCommits = new Map<string, Promise<string>>();
  const previewSources = new Map<string, ReturnType<typeof install>>();
  const catalogEntry = async (installName: string) => selectExtensionCatalogEntry(await catalog, installName);
  const releaseRefFor = (entry: ExtensionCatalogEntry) => {
    const ref = upgradeRef(entry, deps.release);
    if (ref !== undefined) return ref;
    throw new ExtensionUpgradeUnavailableError("This extension requires a Prompt Studio host release ref.");
  };
  const currentReleaseCommit = (origin: { url: string; path: string }, releaseRef: string) => {
    const key = releaseCommitKey(origin, releaseRef);
    let commit = releaseCommits.get(key);
    if (!commit) {
      commit = (deps.resolveReleaseCommit ?? resolveExtensionReleaseCommit)(origin.url, releaseRef, origin.path).catch(
        (error) => {
          if (releaseCommits.get(key) === commit) releaseCommits.delete(key);
          throw error;
        },
      );
      releaseCommits.set(key, commit);
    }
    return commit;
  };
  // A Git install from the catalog's own repository and folder is host-managed, so it moves
  // to the registry. Any other Git or local source stays under its owner's control.
  const canMoveToRegistry = async (
    entry: ExtensionCatalogEntry | undefined,
    parsed: ReturnType<typeof parseExtensionSourceRef>,
    version: string | null | undefined,
  ) => {
    if (!entry || !parsed || !version || !matchesCatalogOrigin(entry, parsed)) return false;
    return registry.canUpgradeCatalog(entry, version);
  };
  const canUpgradeGitSource = async (
    source: UpgradeSource,
    parsed: ReturnType<typeof parseExtensionSourceRef>,
    origin: { url: string; path: string },
    releaseRef: string,
  ) => {
    const bundled = await findBundledExtensionSource(origin, releaseRef);
    if (bundled && source.version && Bun.semver.order(bundled.version, source.version) < 0) return false;
    if (parsed?.commit === (bundled?.commit ?? releaseRef.toLowerCase())) return false;
    if (!bundled && deps.release?.source !== "workspace" && !(await isGitAvailable())) return false;
    if (!parsed) return compatibilityError(source) !== null;
    try {
      return parsed.commit !== (await currentReleaseCommit(parsed, releaseRef));
    } catch (error) {
      // Keep the recovery action available when the release ref cannot be checked yet.
      return !(error instanceof GitUnavailableError);
    }
  };
  const canUpgrade = async (source: UpgradeSource) => {
    if (registry.matches(source)) return registry.canUpgrade(source);
    const entry = await catalogEntry(source.install_name);
    const parsed = parseExtensionSourceRef(source.source_ref);
    if (deps.release?.source === "registry") return canMoveToRegistry(entry, parsed, source.version);
    const origin = parsed ?? entry?.origin;
    const releaseRef = upgradeRef(entry, deps.release);
    if (!origin || !releaseRef || !upgradableOrigin(await catalog, entry, parsed)) return false;
    return canUpgradeGitSource(source, parsed, origin, releaseRef);
  };
  const requireCatalogEntry = async (installName: string) => {
    const entry = await catalogEntry(installName);
    if (!entry) throw new ExtensionUpgradeUnavailableError(`No catalog entry for extension: ${installName}`);
    releaseRefFor(entry);
    return entry;
  };

  const installForRelease = async (
    installName: string,
    identity: string,
    installedSourcePath: string,
    upgradeFromVersion: string | null,
    repoPath?: string,
  ) => {
    const entry = await requireCatalogEntry(installName);
    const options = {
      installName,
      installedSourcePath,
      upgradeFromVersion,
      force: true,
      retainBackup: true,
      ...(repoPath ? { repoPath } : {}),
    };
    if (deps.release?.source === "registry" && entry.extensionId) return registry.installCatalog(entry, options);
    const workspaceSource = deps.release?.source === "workspace" && entry.origin.ref === "{hostRelease}";
    const source =
      workspaceSource && deps.release?.source === "workspace"
        ? join(deps.release.root, entry.origin.path)
        : installName;
    return install({
      source,
      ...options,
      ...(workspaceSource ? { skipInstall: true } : { hostReleaseRef: deps.release?.ref }),
      ...(!workspaceSource && entry.origin.url.startsWith("https:") ? { expectedIdentity: identity } : {}),
      reuseInstalledDependencies: workspaceSource,
    });
  };

  const prepareMarketplaceExtensionSource = async (installName: string) => {
    const entry = await requireCatalogEntry(installName);
    if (deps.release?.source === "registry" && entry.extensionId) {
      return registry.installCatalog(entry, {
        env: {
          ...process.env,
          PSTDIO_HOME: join(resolvePstdioHome({ env: process.env }), "cache", "extension-previews"),
        },
        installName,
        force: true,
      });
    }
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

  const installSource = createExtensionSourceInstaller({ deps, install, catalogEntry, releaseRefFor });

  const upgradeInstalled = async (source: InstalledSource, repoPath?: string) => {
    const entry = await catalogEntry(source.install_name);
    const parsed = parseExtensionSourceRef(source.source_ref);
    // Select once for this operation; the worker downloads and validates that exact release.
    const registrySource = await registry.upgradeTarget(
      source,
      parsed && matchesCatalogOrigin(entry, parsed) ? entry : undefined,
    );
    if (!registrySource && !(await canUpgrade(source)))
      throw new ExtensionUpgradeUnavailableError("This extension is already up to date.");
    const upgradeFromVersion = source.version ?? null;
    let installed: Awaited<ReturnType<typeof install>>;
    if (registrySource) {
      installed = await install({
        source: registrySource.id,
        registrySource,
        installedSourcePath: source.source_path,
        upgradeFromVersion,
        installName: source.install_name,
        force: true,
        retainBackup: true,
        repoPath,
      });
    } else if (entry) {
      installed = await installForRelease(
        source.install_name,
        source.extension_id,
        source.source_path,
        upgradeFromVersion,
        repoPath,
      );
    } else if (parsed && deps.release?.ref) {
      installed = await installFromRecordedOrigin({
        install,
        installName: source.install_name,
        origin: { url: parsed.url, path: parsed.path },
        hostReleaseRef: deps.release.ref,
        identity: source.extension_id,
        installedSourcePath: source.source_path,
        upgradeFromVersion,
        repoPath,
      });
    } else {
      throw new ExtensionUpgradeUnavailableError(`No upgrade origin for extension: ${source.install_name}`);
    }
    const installedSource = await deps.extensionService.registerInstalledSource({
      installName: installed.installName,
      ...toExtensionEnableInput(installed),
    });
    const installedOrigin = parseExtensionSourceRef(installedSource.source_ref);
    const releaseRef = entry ? releaseRefFor(entry) : deps.release?.ref;
    if (installedOrigin && releaseRef) releaseCommits.delete(releaseCommitKey(installedOrigin, releaseRef));

    return {
      changed: source.source_hash !== installed.sourceHash,
      installedSource,
    };
  };

  return {
    canUpgrade,
    enabled: true,
    installSource,
    prepareMarketplaceExtensionSource,
    releaseRef: deps.release?.ref,
    registry: deps.release?.source === "registry" ? deps.release.ref.slice(4) : undefined,
    upgrade: projectUpgrade(deps, upgradeInstalled),
    upgradeInstalled,
  };
};
