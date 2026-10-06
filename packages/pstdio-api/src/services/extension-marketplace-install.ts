import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ExtensionCatalogEntry } from "../features/extensions/extension-catalog";
import {
  type InstalledExtensionSource,
  RepoScopedExtensionNeedsProjectFolderError,
  toExtensionEnableInput,
} from "../features/extensions/install-extension-source";
import { parseExtensionSourceRef } from "./extension-source-ref";
import type { ExtensionService, ExtensionUpgradeServiceDeps } from "./extension-upgrade-service";
import { ExtensionUpgradeUnavailableError } from "./extension-upgrade-unavailable-error";

type MarketplaceInstallDeps = Pick<ExtensionUpgradeServiceDeps, "extensionService" | "workspaceService">;

type MarketplaceInstallInput = {
  deps: MarketplaceInstallDeps;
  installForRelease: (installName: string, repoPath?: string) => Promise<InstalledExtensionSource>;
  requireCatalogEntry: (installName: string) => Promise<ExtensionCatalogEntry>;
};

const repoScopeUnavailableMessage =
  "This extension installs into the project folder. Open the project from a local folder.";

const extensionScope = (manifest: unknown) => {
  if (!manifest || typeof manifest !== "object" || !("pstdio" in manifest)) return "user";
  const pstdio = manifest.pstdio;
  return pstdio && typeof pstdio === "object" && "scope" in pstdio && pstdio.scope === "repo" ? "repo" : "user";
};

const enableExisting = async (
  deps: MarketplaceInstallDeps,
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

export const createMarketplaceExtensionInstaller = (input: MarketplaceInstallInput) => {
  const { deps, installForRelease, requireCatalogEntry } = input;

  return async (projectId: string, installName: string) => {
    const requestedEntry = await requireCatalogEntry(installName);
    const workspace = await deps.workspaceService.getDefault(projectId);
    const projectFolder = workspace?.root_path ?? undefined;
    const records = await deps.extensionService.listProjectExtensionInstances(projectId);
    const knownRepoScope = records.some(
      (record) =>
        record.installedSource.install_name === installName &&
        extensionScope(record.installedSource.manifest_json) === "repo",
    );

    const installRepoScoped = async (installed?: Awaited<ReturnType<typeof installForRelease>>) => {
      if (!projectFolder) throw new ExtensionUpgradeUnavailableError(repoScopeUnavailableMessage);
      const targetPath = resolve(projectFolder, ".pstdio/extensions", installName);
      const existing = records.find(
        (record) => resolve(record.installedSource.source_path) === targetPath && existsSync(targetPath),
      );
      if (existing) return enableExisting(deps, projectId, existing.installedSource);

      const resolved = installed ?? (await installForRelease(installName, projectFolder));
      return deps.extensionService.enableInstalledSourceForProject({
        installName: resolved.installName,
        projectId,
        ...toExtensionEnableInput(resolved),
      });
    };

    if (knownRepoScope) return installRepoScoped();

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
      installed = await installForRelease(installName, projectFolder);
    } catch (error) {
      if (error instanceof RepoScopedExtensionNeedsProjectFolderError) {
        throw new ExtensionUpgradeUnavailableError(repoScopeUnavailableMessage);
      }
      throw error;
    }
    if (extensionScope(installed.manifest) === "repo") return installRepoScoped(installed);

    return deps.extensionService.enableInstalledSourceForProject({
      installName: installed.installName,
      projectId,
      ...toExtensionEnableInput(installed),
    });
  };
};
