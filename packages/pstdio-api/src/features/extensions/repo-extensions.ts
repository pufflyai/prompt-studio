import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type ExtensionDiagnostic, loadExtensionPackage } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "./deps";
import { hashExtensionSource } from "./extension-runtime";

type SyncRepoExtensionsDeps = Pick<ExtensionsRouteDeps, "extensionService" | "repoService">;

const repoHash = (repoPath: string) => createHash("sha1").update(repoPath).digest("hex").slice(0, 8);

const firstError = (diagnostics: ExtensionDiagnostic[]) => {
  const diagnostic = diagnostics.find((item) => item.severity === "error") ?? diagnostics[0];
  return diagnostic ? { code: diagnostic.code, message: diagnostic.message } : { message: "Extension failed to load" };
};

const manifestSnapshot = (loaded: NonNullable<Awaited<ReturnType<typeof loadExtensionPackage>>>) => ({
  id: loaded.manifest.id,
  name: loaded.manifest.name,
  displayName: loaded.manifest.displayName ?? loaded.manifest.name,
  version: loaded.manifest.version,
  description: loaded.manifest.description,
  enginesPstdio: loaded.manifest.enginesPstdio,
  commands: Object.keys(loaded.definition.commands ?? {}),
  hooks: Object.keys(loaded.definition.hooks ?? {}),
  middlewares: Object.keys(loaded.definition.middlewares ?? {}),
});

const fallbackIdentity = (dirName: string, installName: string) => ({
  displayName: dirName,
  extensionId: installName,
  name: dirName,
  version: null,
});

const syncPackage = async (
  deps: SyncRepoExtensionsDeps,
  input: { dirName: string; installName: string; projectId: string; sourcePath: string },
) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: input.sourcePath, sourceKind: "local_path" }, diagnostics);
  const error = firstError(diagnostics);
  const hasError = diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const identity = loaded
    ? {
        displayName: loaded.manifest.displayName ?? loaded.manifest.name,
        extensionId: loaded.manifest.id,
        name: loaded.manifest.name,
        version: loaded.manifest.version,
      }
    : fallbackIdentity(input.dirName, input.installName);

  if (!loaded || hasError) {
    const source = await deps.extensionService.registerInstalledSourceError({
      ...identity,
      error,
      installName: input.installName,
      manifest: loaded ? manifestSnapshot(loaded) : { diagnostics },
      sourceHash: hashExtensionSource(input.sourcePath),
      sourceKind: "local_path",
      sourcePath: input.sourcePath,
    });
    const instances = await deps.extensionService.listProjectExtensionInstances(input.projectId);
    const instance = instances.find((record) => record.installedSource.id === source.id)?.instance;
    const restored = await deps.extensionService.restoreProjectInstanceFromLocalOverride(input.projectId, source.id);
    if (!restored && instance?.enabled) await deps.extensionService.setProjectExtensionEnabled(instance.id, false);
    return;
  }

  await deps.extensionService.enableInstalledSourceForProject({
    ...identity,
    installName: input.installName,
    manifest: manifestSnapshot(loaded),
    projectId: input.projectId,
    sourceHash: hashExtensionSource(input.sourcePath),
    sourceKind: "local_path",
    sourcePath: input.sourcePath,
  });
};

const syncRepoExtensionRoot = async (
  deps: SyncRepoExtensionsDeps,
  input: { prefix: string; projectId: string; root: string; seenInstallNames: Set<string> },
) => {
  if (!existsSync(input.root)) return;

  for (const entry of readdirSync(input.root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const installName = `${input.prefix}${entry.name}`;
    input.seenInstallNames.add(installName);
    await syncPackage(deps, {
      dirName: entry.name,
      installName,
      projectId: input.projectId,
      sourcePath: join(input.root, entry.name),
    });
  }
};

export const syncRepoExtensionsForRemovedRepo = async (
  deps: SyncRepoExtensionsDeps,
  input: { projectId: string; repoPath: string },
) => {
  await reconcileRemovedRepoExtensions(deps, {
    prefix: `local:${repoHash(input.repoPath)}:`,
    projectId: input.projectId,
    seenInstallNames: new Set(),
  });
};

const reconcileRemovedRepoExtensions = async (
  deps: SyncRepoExtensionsDeps,
  input: { prefix: string; projectId: string; seenInstallNames: Set<string> },
) => {
  const installed = await deps.extensionService.listInstalledSourcesByInstallNamePrefix(input.prefix);
  const instances = await deps.extensionService.listProjectExtensionInstances(input.projectId);
  for (const source of installed) {
    if (input.seenInstallNames.has(source.install_name)) continue;
    const instance = instances.find((record) => record.installedSource.id === source.id)?.instance;
    const restored = await deps.extensionService.restoreProjectInstanceFromLocalOverride(input.projectId, source.id);
    if (!restored && instance?.enabled) await deps.extensionService.setProjectExtensionEnabled(instance.id, false);
    if (source.status !== "uninstalled") await deps.extensionService.markInstalledSourceUninstalled(source.id);
  }
};

export const syncRepoExtensionsForProject = async (deps: SyncRepoExtensionsDeps, projectId: string) => {
  const repos = await deps.repoService.listByProject(projectId);
  const seenInstallNames = new Set<string>();

  for (const repo of repos) {
    const prefix = `local:${repoHash(repo.path)}:`;
    const root = join(repo.path, ".pstdio", "extensions");
    await syncRepoExtensionRoot(deps, { prefix, projectId, root, seenInstallNames });
    await reconcileRemovedRepoExtensions(deps, { prefix, projectId, seenInstallNames });
  }
};
