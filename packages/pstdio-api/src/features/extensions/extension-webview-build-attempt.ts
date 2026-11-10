import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { cp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inspectExtensionLoadKey } from "pstdio-extensions";
import { recordPublishedWebviewRevision } from "pstdio-extensions/prepared-cache";
import { runExtensionPreparation } from "./extension-preparation";
import type { LoadedExtensionSnapshot } from "./extension-runtime";
import { signatureFor } from "./extension-webview-build-backoff";
import { prepareWebviewBuildCache, publishedWebviewModule } from "./extension-webview-build-cache";
import {
  type InstalledSourceWithManifest,
  runExtensionWebviewBuild,
  webviewBuildFailure,
} from "./extension-webview-build-runner";
import {
  inspectManagedWebviewBuildInputsAsync,
  prepareManagedWebviewBuildSourceAsync,
} from "./extension-webview-build-source";
import type { ExtensionWebviewBuilder } from "./extension-webview-builder";
import type { loadCurrentWebviewSource } from "./extension-webview-source-load";
import {
  type CollectedExtensionWebview,
  classifyWebviewEntry,
  collectExtensionWebviews,
  resolveManagedWebviewPaths,
  resolveWebviewSourceEntry,
} from "./extension-webviews";

export const inspectWebviewBuild = async (
  row: InstalledSourceWithManifest,
  packageName: string,
  webview: CollectedExtensionWebview,
  preparedPackagePath?: string,
) => {
  const sourceEntryPath = resolveWebviewSourceEntry(webview.entry, row.source_path, preparedPackagePath);
  const buildInputs = await inspectManagedWebviewBuildInputsAsync({
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
  inspectLoadKey = inspectExtensionLoadKey,
) => {
  while (true) {
    const current = await loadCurrentSource(identity.row.id, identity.snapshot);
    if (!current || current.row.source_path !== identity.row.source_path) return null;
    const runtimeId = identity.snapshot.loaded.preparedRevision?.id;
    if (
      runtimeId &&
      runtimeId !== identity.snapshot.loadKey &&
      current.snapshot.loaded.preparedRevision?.id !== runtimeId
    )
      return null;
    const owned = collectExtensionWebviews(current.snapshot.loaded).find((view) => view.id === identity.webview.id);
    if (
      !owned ||
      classifyWebviewEntry(owned.entry).kind !== "managed" ||
      resolveWebviewSourceEntry(
        owned.entry,
        current.row.source_path,
        current.snapshot.loaded.preparedRevision?.packagePath,
      ) !==
        resolveWebviewSourceEntry(
          identity.webview.entry,
          identity.row.source_path,
          identity.snapshot.loaded.preparedRevision?.packagePath,
        )
    )
      return null;
    const inspected = await inspectWebviewBuild(
      current.row,
      current.snapshot.loaded.metadata.name,
      owned,
      current.snapshot.loaded.preparedRevision?.packagePath,
    );
    if (current.snapshot.loadKey !== (await inspectLoadKey(current.row.source_path))) continue;
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
  reusePreparedArtifacts?: boolean;
}

interface BuildInput extends Awaited<ReturnType<typeof inspectWebviewBuild>>, ManagedWebviewBuildIdentity {
  isCurrent: () => boolean;
}

const buildRetainedWebview = async (context: BuildContext, input: BuildInput, stageDir: string, distDir: string) => {
  const { row, webview, sourceEntryPath, snapshot, isCurrent, signature, buildInputs } = input;
  const packageName = snapshot.loaded.metadata.name;
  const controller = new AbortController();
  context.activeBuilds.add(controller);
  try {
    const artifact = await runExtensionPreparation<{ id: string; distDir: string }>(
      "webview.artifact",
      {
        entryPath: sourceEntryPath,
        packagePath: row.source_path,
        packageName,
        installName: row.install_name,
        buildInputs,
      },
      { signal: controller.signal },
    );
    if (!isCurrent()) return { status: "unavailable" as const };
    const current = await context.findCurrentSource(input);
    if (!current || !isCurrent()) return { status: "unavailable" as const };
    await mkdir(stageDir, { recursive: true });
    await cp(artifact.distDir, stageDir, { recursive: true });
    await writeFile(join(stageDir, "build-signature.txt"), signature);
    if (!isCurrent() || !(await context.findCurrentSource(input))) return { status: "unavailable" as const };
    await rm(distDir, { recursive: true, force: true });
    await rename(stageDir, distDir);
    recordPublishedWebviewRevision(distDir, signature);
    return { status: "success" as const, artifact };
  } catch (error) {
    if (!isCurrent()) return { status: "unavailable" as const };
    return {
      status: "failure" as const,
      error: webviewBuildFailure(row.install_name, webview.id, error instanceof Error ? error.message : String(error)),
    };
  } finally {
    context.activeBuilds.delete(controller);
  }
};

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
    if (context.reusePreparedArtifacts) return await buildRetainedWebview(context, input, stageDir, paths.distDir);
    const source = await prepareManagedWebviewBuildSourceAsync({
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
    recordPublishedWebviewRevision(paths.distDir, signature);
    return { ...outcome, artifact: undefined };
  } finally {
    rmSync(stageDir, { recursive: true, force: true });
    context.activeStages.delete(stageDir);
  }
};

export type ManagedWebviewBuildResult = Awaited<ReturnType<ReturnType<typeof createManagedWebviewBuilder>>>;
