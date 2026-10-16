import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extensionLoadKey } from "pstdio-extensions";
import type { LoadedExtensionSnapshot } from "./extension-runtime";
import { signatureFor } from "./extension-webview-build-backoff";
import { prepareWebviewBuildCache, publishedWebviewModule } from "./extension-webview-build-cache";
import {
  type InstalledSourceWithManifest,
  runExtensionWebviewBuild,
  webviewBuildFailure,
} from "./extension-webview-build-runner";
import { inspectManagedWebviewBuildInputs, prepareManagedWebviewBuildSource } from "./extension-webview-build-source";
import type { ExtensionWebviewBuilder } from "./extension-webview-builder";
import type { loadCurrentWebviewSource } from "./extension-webview-source-load";
import {
  type CollectedExtensionWebview,
  classifyWebviewEntry,
  collectExtensionWebviews,
  resolveManagedWebviewPaths,
  resolvePackageAssetFile,
} from "./extension-webviews";

export const inspectWebviewBuild = (
  row: InstalledSourceWithManifest,
  packageName: string,
  webview: CollectedExtensionWebview,
) => {
  const sourceEntryPath = resolvePackageAssetFile(webview.entry);
  const buildInputs = inspectManagedWebviewBuildInputs({
    entryPath: sourceEntryPath,
    installName: row.install_name,
    packageName,
    packagePath: row.source_path,
  });
  const signature = signatureFor(row, webview.id, webview.entry.path, buildInputs.signature);
  return { buildInputs, signature, sourceEntryPath };
};

export interface ManagedWebviewBuildIdentity {
  row: InstalledSourceWithManifest;
  signature: string;
  snapshot: LoadedExtensionSnapshot;
  webview: CollectedExtensionWebview;
}

export const findCurrentBuildSource = async (
  loadCurrentSource: (
    id: string,
    validatedSource?: LoadedExtensionSnapshot,
  ) => ReturnType<typeof loadCurrentWebviewSource>,
  identity: ManagedWebviewBuildIdentity,
) => {
  while (true) {
    const current = await loadCurrentSource(identity.row.id, identity.snapshot);
    if (!current || current.row.source_path !== identity.row.source_path) return null;
    const owned = collectExtensionWebviews(current.snapshot.loaded).find((view) => view.id === identity.webview.id);
    if (
      !owned ||
      classifyWebviewEntry(owned.entry).kind !== "managed" ||
      resolvePackageAssetFile(owned.entry) !== resolvePackageAssetFile(identity.webview.entry)
    )
      return null;
    const inspected = inspectWebviewBuild(current.row, current.snapshot.loaded.metadata.name, owned);
    if (current.snapshot.loadKey !== extensionLoadKey(current.row.source_path)) continue;
    return inspected.signature === identity.signature ? current.row : null;
  }
};

export const isWebviewPublished = (webviewCacheRoot: string, installedExtensionId: string, webviewId: string) => {
  const { distDir } = resolveManagedWebviewPaths({ installedExtensionId, webviewCacheRoot, webviewId });
  return existsSync(publishedWebviewModule(distDir));
};

interface BuildContext {
  activeBuilds: Set<AbortController>;
  activeStages: Set<string>;
  buildWebview: ExtensionWebviewBuilder;
  findCurrentSource: (identity: ManagedWebviewBuildIdentity) => Promise<InstalledSourceWithManifest | null>;
  webviewCacheRoot: string;
}

interface BuildInput extends ReturnType<typeof inspectWebviewBuild>, ManagedWebviewBuildIdentity {
  isCurrent: () => boolean;
}

export const createManagedWebviewBuilder = (context: BuildContext) => async (input: BuildInput) => {
  const { row, webview, signature, buildInputs, sourceEntryPath, snapshot, isCurrent } = input;
  const packageName = snapshot.loaded.metadata.name;
  const paths = resolveManagedWebviewPaths({
    installedExtensionId: row.id,
    webviewCacheRoot: context.webviewCacheRoot,
    webviewId: webview.id,
  });
  const stageDir = `${paths.distDir}.staging-${crypto.randomUUID()}`;
  prepareWebviewBuildCache(paths.distDir, context.activeStages);
  context.activeStages.add(stageDir);
  try {
    const source = prepareManagedWebviewBuildSource({
      buildInputs,
      entryPath: sourceEntryPath,
      installName: row.install_name,
      packageName,
      packagePath: row.source_path,
      shellDir: paths.shellDir,
    });
    if (!source.success)
      return { status: "failure" as const, error: webviewBuildFailure(row.install_name, webview.id, source.details) };
    const outcome = await runExtensionWebviewBuild({
      activeBuilds: context.activeBuilds,
      buildWebview: context.buildWebview,
      distDir: stageDir,
      entryPath: source.entryPath,
      isCurrent,
      row,
      webviewId: webview.id,
    });
    if (outcome.status !== "success") return outcome;
    if (!isCurrent()) return { status: "unavailable" as const };
    const current = await context.findCurrentSource(input);
    if (!current || !isCurrent()) return { status: "unavailable" as const };
    writeFileSync(join(stageDir, "build-signature.txt"), signature);
    rmSync(paths.distDir, { recursive: true, force: true });
    renameSync(stageDir, paths.distDir);
    return outcome;
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
    context.activeStages.delete(stageDir);
  }
};

export type ManagedWebviewBuildResult = Awaited<ReturnType<ReturnType<typeof createManagedWebviewBuilder>>>;
