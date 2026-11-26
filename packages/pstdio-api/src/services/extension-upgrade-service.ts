import { join, resolve } from "node:path";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import { GitUnavailableError, isGitAvailable } from "pstdio-wt";
import type { ExtensionRelease } from "../app-config";
import { findBundledExtensionSource } from "../features/extensions/bundled-extension-source";
import {
  type ExtensionCatalog,
  type ExtensionCatalogEntry,
  getExtensionCatalog,
  selectExtensionCatalogEntry,
} from "../features/extensions/extension-catalog";
import { ExtensionUpgradeNeedsReviewError } from "../features/extensions/extension-upgrade-baseline";
import {
  type InstallExtensionSourceInput,
  installExtensionSource as installExtensionSourceDefault,
  toExtensionEnableInput,
} from "../features/extensions/install-extension-source";
import { isManagedCatalogSource } from "../features/extensions/managed-catalog-source";
import { compatibilityError } from "../features/extensions/project-extension-instance";
import type { BundledReleaseTarget, RegistryReleaseTarget } from "../features/extensions/warm-extension-release";
import { createExtensionMarketplacePreview } from "./extension-marketplace-preview";
import type { createExtensionService } from "./extension-service";
import { createExtensionSourceInstaller } from "./extension-source-installer";
import { parseExtensionSourceRef, resolveExtensionReleaseCommit } from "./extension-source-ref";
import { createExtensionUpgradeReviewService } from "./extension-upgrade-review-service";
import { ExtensionUpgradeUnavailableError } from "./extension-upgrade-unavailable-error";
import { createPublishedExtensionAlternative } from "./published-extension-alternative";
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
  home?: string;
  prefetchRegistryRelease?: (target: RegistryReleaseTarget) => void;
  prefetchBundledRelease?: (target: BundledReleaseTarget) => void;
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

type UpgradeDestination = {
  installedSourcePath: string;
  upgradeFromVersion: string | null;
  upgradeBase: NonNullable<InstallExtensionSourceInput["upgradeBase"]>;
  repoPath?: string;
};

const recordedOriginInput = (input: {
  installName: string;
  origin: { url: string; path: string };
  hostReleaseRef: string;
  identity: string;
  destination: UpgradeDestination;
}) =>
  ({
    source: input.installName,
    installName: input.installName,
    ...input.destination,
    force: true,
    retainBackup: true,
    ref: input.hostReleaseRef,
    hostReleaseRef: input.hostReleaseRef,
    ...(input.origin.url.startsWith("https:") ? { expectedIdentity: input.identity } : {}),
    originSource: { kind: "release", origin: { kind: "git", ...input.origin, ref: input.hostReleaseRef } },
    reuseInstalledDependencies: true,
  }) satisfies InstallExtensionSourceInput;

const extensionUpgradeDestination = async (
  deps: ExtensionUpgradeServiceDeps,
  projectId: string | undefined,
  source: { source_path: string; source_ref: string | null; version?: string | null },
  sourceRepoPath?: string,
): Promise<UpgradeDestination> => {
  const root = projectId ? (await deps.workspaceService.getDefault(projectId))?.root_path : sourceRepoPath;
  const { source_path: path, source_ref: ref, version } = source;
  const repoPath = root && resolve(root, ".pstdio/extensions") === resolve(path, "..") ? root : undefined;
  return {
    installedSourcePath: path,
    upgradeFromVersion: version ?? null,
    upgradeBase: { path, ref },
    ...(repoPath ? { repoPath } : {}),
  };
};

type UpgradeInstance = NonNullable<Awaited<ReturnType<ExtensionService["getProjectExtensionInstance"]>>>;
const findLocalProvider = async (
  catalog: Promise<ExtensionCatalog>,
  service: ExtensionService,
  projectId: string,
  current: UpgradeInstance,
) => {
  if (current.instance.enabled && current.installedSource.source_kind === "local_path") {
    // Older hosts rediscovered catalog installs as local paths. The normal install
    // still verifies their exact original working tree before replacing any files.
    if (isManagedCatalogSource(current.installedSource, await catalog)) return undefined;
    return current;
  }
  if (current.instance.enabled !== false) return undefined;
  const id = canonicalExtensionId(current.installedSource.extension_id);
  return (await service.listProjectExtensionInstances(projectId)).find(
    ({ instance, installedSource }) =>
      instance.enabled &&
      installedSource.source_kind === "local_path" &&
      canonicalExtensionId(installedSource.extension_id) === id,
  );
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

const releaseRefFor = (entry: ExtensionCatalogEntry, release: ExtensionRelease | null) => {
  const ref = upgradeRef(entry, release);
  if (ref !== undefined) return ref;
  throw new ExtensionUpgradeUnavailableError("This extension requires a Prompt Studio host release ref.");
};

const releaseCommitKey = (origin: { url: string; path: string }, ref: string) =>
  `${origin.url}\0${origin.path}\0${ref}`;

const createReleaseCommitCache = (resolveCommit: typeof resolveExtensionReleaseCommit) => {
  const commits = new Map<string, Promise<string>>();
  const get = (origin: { url: string; path: string }, ref: string) => {
    const key = releaseCommitKey(origin, ref);
    let commit = commits.get(key);
    if (!commit) {
      commit = resolveCommit(origin.url, ref, origin.path).catch((error) => {
        if (commits.get(key) === commit) commits.delete(key);
        throw error;
      });
      commits.set(key, commit);
    }
    return commit;
  };
  return {
    get,
    invalidate: (origin: { url: string; path: string }, ref: string) => commits.delete(releaseCommitKey(origin, ref)),
  };
};

export const createExtensionUpgradeService = (deps: ExtensionUpgradeServiceDeps) => {
  const install = deps.installExtensionSource ?? installExtensionSourceDefault;
  const registry = createRegistryExtensionSource(deps, install);
  const catalog = deps.catalog ? Promise.resolve(deps.catalog) : getExtensionCatalog();
  const separateLocalProvider = (projectId: string, current: UpgradeInstance) =>
    findLocalProvider(catalog, deps.extensionService, projectId, current);
  const publishedAlternative = createPublishedExtensionAlternative(catalog, deps.release);
  const releaseCommits = createReleaseCommitCache(deps.resolveReleaseCommit ?? resolveExtensionReleaseCommit);
  const catalogEntry = async (installName: string) => selectExtensionCatalogEntry(await catalog, installName);
  const catalogReleaseRef = (entry: ExtensionCatalogEntry) => releaseRefFor(entry, deps.release);
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
    if (bundled?.descriptor && parsed)
      deps.prefetchBundledRelease?.({ origin, ref: releaseRef, sha256: bundled.descriptor.sha256 });
    if (!bundled && deps.release?.source !== "workspace" && !(await isGitAvailable())) return false;
    if (!parsed) return compatibilityError(source) !== null;
    try {
      return parsed.commit !== (await releaseCommits.get(parsed, releaseRef));
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
    if (deps.release?.source === "workspace" && entry?.origin.ref === "{hostRelease}" && compatibilityError(source))
      return true;
    return canUpgradeGitSource(source, parsed, origin, releaseRef);
  };
  const requireCatalogEntry = async (installName: string) => {
    const entry = await catalogEntry(installName);
    if (!entry) throw new ExtensionUpgradeUnavailableError(`No catalog entry for extension: ${installName}`);
    catalogReleaseRef(entry);
    return entry;
  };

  const catalogUpgradeInput = async (
    installName: string,
    identity: string,
    destination: UpgradeDestination,
  ): Promise<InstallExtensionSourceInput> => {
    const entry = await requireCatalogEntry(installName);
    const options = {
      installName,
      ...destination,
      force: true,
      retainBackup: true,
    };
    if (deps.release?.source === "registry" && entry.extensionId) {
      return {
        ...options,
        source: entry.extensionId,
        registrySource: { url: deps.release.ref.slice(4), id: entry.extensionId },
      };
    }
    const workspaceSource = deps.release?.source === "workspace" && entry.origin.ref === "{hostRelease}";
    const source =
      workspaceSource && deps.release?.source === "workspace"
        ? join(deps.release.root, entry.origin.path)
        : installName;
    return {
      source,
      ...options,
      ...(workspaceSource ? { skipInstall: true } : { hostReleaseRef: deps.release?.ref }),
      ...(!workspaceSource && entry.origin.url.startsWith("https:") ? { expectedIdentity: identity } : {}),
      reuseInstalledDependencies: true,
    };
  };

  const prepareMarketplaceExtensionSource = createExtensionMarketplacePreview({
    deps,
    install,
    registry,
    requireCatalogEntry,
    releaseRefFor: catalogReleaseRef,
  });

  const installSource = createExtensionSourceInstaller({
    deps,
    install,
    catalogEntry,
    releaseRefFor: catalogReleaseRef,
  });

  type InstalledSource = NonNullable<Awaited<ReturnType<ExtensionService["getInstalledSource"]>>>;
  type ExistingInstance = NonNullable<Awaited<ReturnType<ExtensionService["getProjectExtensionInstance"]>>>;
  const resolveUpgradeInput = async (
    projectId: string | undefined,
    existing: Pick<ExistingInstance, "installedSource">,
    repoPath?: string,
  ): Promise<InstallExtensionSourceInput> => {
    const { installedSource } = existing;
    const entry = await catalogEntry(installedSource.install_name);
    const parsed = parseExtensionSourceRef(installedSource.source_ref);
    const registrySource = await registry.upgradeTarget(
      installedSource,
      parsed && matchesCatalogOrigin(entry, parsed) ? entry : undefined,
    );
    if (!registrySource && !(await canUpgrade(installedSource)))
      throw new ExtensionUpgradeUnavailableError("This extension is already up to date.");
    const destination = await extensionUpgradeDestination(deps, projectId, installedSource, repoPath);
    if (registrySource)
      return {
        source: registrySource.id,
        registrySource,
        ...destination,
        installName: installedSource.install_name,
        force: true,
        retainBackup: true,
      };
    if (entry) return catalogUpgradeInput(installedSource.install_name, installedSource.extension_id, destination);
    if (parsed && deps.release?.ref)
      return recordedOriginInput({
        installName: installedSource.install_name,
        origin: { url: parsed.url, path: parsed.path },
        hostReleaseRef: deps.release.ref,
        identity: installedSource.extension_id,
        destination,
      });
    throw new ExtensionUpgradeUnavailableError(`No upgrade origin for extension: ${installedSource.install_name}`);
  };

  const registerInstalledUpgrade = async (source: InstalledSource, installed: Awaited<ReturnType<typeof install>>) => {
    const entry = await catalogEntry(source.install_name);
    const installedSource = await deps.extensionService.registerInstalledSource({
      installName: installed.installName,
      ...toExtensionEnableInput(installed),
    });
    const installedOrigin = parseExtensionSourceRef(installedSource.source_ref);
    const releaseRef = entry ? catalogReleaseRef(entry) : deps.release?.ref;
    if (installedOrigin && releaseRef) releaseCommits.invalidate(installedOrigin, releaseRef);

    return {
      changed: source.source_hash !== installed.sourceHash,
      installedSource,
    };
  };

  const registerUpgrade = async (existing: ExistingInstance, installed: Awaited<ReturnType<typeof install>>) => ({
    ...(await registerInstalledUpgrade(existing.installedSource, installed)),
    instance: existing.instance,
  });
  const upgradeInstalled = async (source: InstalledSource, repoPath?: string) => {
    const input = await resolveUpgradeInput(undefined, { installedSource: source }, repoPath);
    // Startup already admits unchanged sources by their stored hash, without needing the old release.
    delete input.upgradeBase;
    return registerInstalledUpgrade(source, await install(input));
  };

  const upgrade = async (projectId: string, instanceId: string) => {
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return null;
    const local = await separateLocalProvider(projectId, existing);
    if (local) {
      throw new ExtensionUpgradeNeedsReviewError(
        `This project is using a local copy of ${local.installedSource.display_name}. The local files were kept.`,
      );
    }
    const input = await resolveUpgradeInput(projectId, existing);
    return registerUpgrade(existing, await install(input));
  };

  return {
    canUpgrade,
    enabled: true,
    installSource,
    prepareMarketplaceExtensionSource,
    releaseRef: deps.release?.ref,
    registry: deps.release?.source === "registry" ? deps.release.ref.slice(4) : undefined,
    upgrade,
    upgradeInstalled,
    hasPublishedAlternative: publishedAlternative.available,
    reviews: createExtensionUpgradeReviewService({
      deps,
      install,
      resolveUpgradeInput,
      registerUpgrade,
      separateLocalProvider,
      resolvePublishedInput: publishedAlternative.input,
      extensionUpgradeDestination,
    }),
  };
};
