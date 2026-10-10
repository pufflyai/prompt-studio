import { renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type LoadedExtension, loadExtensionSource } from "./extension-runtime";
import { createWebviewBuildBackoff, processKey, signatureFor } from "./extension-webview-build-backoff";
import {
  prepareWebviewBuildCache,
  readWebviewBuildSignature,
  removeUnownedWebviewBuilds,
} from "./extension-webview-build-cache";
import { defaultWebviewCacheRoot } from "./extension-webview-build-paths";
import {
  expectedWebviewBuildSource,
  type InstalledSourceWithManifest,
  runExtensionWebviewBuild,
  webviewBuildFailure,
} from "./extension-webview-build-runner";
import { inspectManagedWebviewBuildInputs, prepareManagedWebviewBuildSource } from "./extension-webview-build-source";
import { buildExtensionWebview, type ExtensionWebviewBuilder } from "./extension-webview-builder";
import { loadWebviewSource } from "./extension-webview-source-load";
import {
  classifyWebviewEntry,
  collectExtensionWebviews,
  resolveManagedWebviewPaths,
  resolvePackageAssetFile,
} from "./extension-webviews";

type ExpectedWebviewBuildSource = {
  sourceHash?: string | null;
  sourcePath: string;
};

export type CreateExtensionWebviewBuildManagerInput = {
  buildWebview?: ExtensionWebviewBuilder;
  listInstalledSources: () => Promise<InstalledSourceWithManifest[]>;
  loadSource?: (sourcePath: string) => Promise<LoadedExtension>;
  onError?: (error: unknown) => void;
  reportBuildFailure: (
    installedExtensionId: string,
    webviewId: string,
    error: unknown,
    expectedSource: ExpectedWebviewBuildSource,
  ) => Promise<unknown>;
  reportBuildSuccess: (
    installedExtensionId: string,
    webviewId: string,
    expectedSource: ExpectedWebviewBuildSource,
  ) => Promise<unknown>;
  webviewCacheRoot?: string;
};

type ManagedWebview = ReturnType<typeof collectExtensionWebviews>[number];

type WebviewBuildResult =
  | {
      builtNow: false;
      key: string;
      signature: string;
      webviewId: string;
    }
  | {
      builtNow: true;
      distDir: string;
      key: string;
      signature: string;
      stageDir: string;
      webviewId: string;
    };

const createBuildReporters = (input: CreateExtensionWebviewBuildManagerInput) => {
  const reportFailure = async (
    installedExtensionId: string,
    webviewId: string,
    error: unknown,
    expectedSource: ExpectedWebviewBuildSource,
  ) => {
    try {
      await input.reportBuildFailure(installedExtensionId, webviewId, error, expectedSource);
    } catch (reportError) {
      input.onError?.(reportError);
    }
  };

  const reportSuccess = async (
    installedExtensionId: string,
    webviewId: string,
    expectedSource: ExpectedWebviewBuildSource,
  ) => {
    try {
      await input.reportBuildSuccess(installedExtensionId, webviewId, expectedSource);
      return true;
    } catch (reportError) {
      input.onError?.(reportError);
      return false;
    }
  };

  return { reportFailure, reportSuccess };
};

const inspectWebviewBuild = (row: InstalledSourceWithManifest, packageName: string, webview: ManagedWebview) => {
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

export const createExtensionWebviewBuildManager = (input: CreateExtensionWebviewBuildManagerInput) => {
  const building = new Map<string, string>();
  const checked = new Set<string>();
  const pending = new Map<string, Promise<void>>();
  const activeStages = new Set<string>();
  const backoff = createWebviewBuildBackoff();
  const activeBuilds = new Set<AbortController>();
  let disposed = false;
  const buildWebview = input.buildWebview ?? buildExtensionWebview;
  const loadSource = input.loadSource ?? loadExtensionSource;
  const webviewCacheRoot = input.webviewCacheRoot ?? defaultWebviewCacheRoot(process.env);
  const { reportFailure, reportSuccess } = createBuildReporters(input);

  const buildNewManagedWebview = async (input: {
    buildInputs: ReturnType<typeof inspectManagedWebviewBuildInputs>;
    key: string;
    packageName: string;
    row: InstalledSourceWithManifest;
    signature: string;
    sourceEntryPath: string;
    webview: ManagedWebview;
  }) => {
    const { buildInputs, key, packageName, row, signature, sourceEntryPath, webview } = input;
    building.set(key, signature);
    backoff.forget(key);
    const paths = resolveManagedWebviewPaths({
      installedExtensionId: row.id,
      webviewCacheRoot,
      webviewId: webview.id,
    });
    const stageDir = `${paths.distDir}.staging-${crypto.randomUUID()}`;
    prepareWebviewBuildCache(paths.distDir, activeStages);
    activeStages.add(stageDir);

    let readyForPublish = false;
    try {
      const buildSource = prepareManagedWebviewBuildSource({
        buildInputs,
        entryPath: sourceEntryPath,
        installName: row.install_name,
        packageName,
        packagePath: row.source_path,
        shellDir: paths.shellDir,
      });
      if (!buildSource.success) {
        if (building.get(key) === signature) {
          await reportFailure(
            row.id,
            webview.id,
            webviewBuildFailure(row.install_name, webview.id, buildSource.details),
            expectedWebviewBuildSource(row),
          );
          backoff.recordFailure(key, signature);
        }
        return null;
      }

      const buildOutcome = await runExtensionWebviewBuild({
        activeBuilds,
        building,
        buildWebview,
        distDir: stageDir,
        entryPath: buildSource.entryPath,
        isDisposed: () => disposed,
        key,
        reportFailure,
        row,
        signature,
        webviewId: webview.id,
      });
      if (buildOutcome !== "success" || disposed) {
        if (!disposed && buildOutcome === "failure" && building.get(key) === signature) {
          backoff.recordFailure(key, signature);
        }
        return null;
      }

      writeFileSync(join(stageDir, "build-signature.txt"), signature);
      readyForPublish = true;
      return { builtNow: true, distDir: paths.distDir, key, signature, stageDir, webviewId: webview.id };
    } finally {
      if (!readyForPublish) {
        rmSync(stageDir, { recursive: true, force: true });
        activeStages.delete(stageDir);
        if (building.get(key) === signature) building.delete(key);
      }
    }
  };

  const buildManagedWebview = async (input: {
    packageName: string;
    row: InstalledSourceWithManifest;
    webview: ManagedWebview;
  }): Promise<WebviewBuildResult | null> => {
    const { packageName, row, webview } = input;
    const key = processKey(row.id, webview.id);
    const { buildInputs, signature, sourceEntryPath } = inspectWebviewBuild(row, packageName, webview);
    const paths = resolveManagedWebviewPaths({
      installedExtensionId: row.id,
      webviewCacheRoot,
      webviewId: webview.id,
    });
    if (readWebviewBuildSignature(paths.distDir) === signature) {
      return { builtNow: false, key, signature, webviewId: webview.id };
    }
    if (building.get(key) === signature) return { builtNow: false, key, signature, webviewId: webview.id };
    if (backoff.isBlocked(key, signature)) return null;
    return buildNewManagedWebview({ buildInputs, key, packageName, row, signature, sourceEntryPath, webview });
  };

  const publishCompletedBuild = async (
    row: InstalledSourceWithManifest,
    result: Extract<WebviewBuildResult, { builtNow: true }>,
  ) => {
    rmSync(result.distDir, { recursive: true, force: true });
    renameSync(result.stageDir, result.distDir);
    const expectedSource = { sourcePath: row.source_path };
    if (await reportSuccess(row.id, result.webviewId, expectedSource)) {
      backoff.forget(result.key);
    }
  };

  const findCurrentBuildSource = async (
    row: InstalledSourceWithManifest,
    result: Extract<WebviewBuildResult, { builtNow: true }>,
    packageName: string,
    webview: ManagedWebview,
  ) => {
    const currentRows = await input.listInstalledSources();
    const currentRow = currentRows.find((current) => current.id === row.id);
    if (!currentRow || currentRow.source_path !== row.source_path) return null;

    const current = inspectWebviewBuild(currentRow, packageName, webview);
    return current.signature === result.signature ? currentRow : null;
  };

  // Resolves true once the source loaded and every managed webview build was attempted.
  const refreshRow = async (row: InstalledSourceWithManifest, validatedSource?: LoadedExtension) => {
    if (disposed) return false;
    const loaded = validatedSource ?? (await loadWebviewSource({ backoff, loadSource, onError: input.onError, row }));
    if (!loaded || disposed) return false;

    const managedWebviews = collectExtensionWebviews(loaded).filter(
      (webview) => classifyWebviewEntry(webview.entry).kind === "managed",
    );
    await Promise.all(
      managedWebviews.map(async (webview) => {
        const key = processKey(row.id, webview.id);
        const result = await buildManagedWebview({ packageName: loaded.metadata.name, row, webview });
        if (!result?.builtNow) return;
        try {
          if (disposed || building.get(key) !== result.signature) return;
          const currentRow = await findCurrentBuildSource(row, result, loaded.metadata.name, webview);
          if (!currentRow || disposed || building.get(key) !== result.signature) return;

          await publishCompletedBuild(currentRow, result);
        } finally {
          rmSync(result.stageDir, { recursive: true, force: true });
          activeStages.delete(result.stageDir);
          if (building.get(key) === result.signature) building.delete(key);
        }
      }),
    );
    return true;
  };

  const check = (installedExtensionId: string, validatedSource?: LoadedExtension) => {
    const previous = pending.get(installedExtensionId);
    const work = (async () => {
      if (disposed) return false;
      const row = (await input.listInstalledSources()).find((row) => row.id === installedExtensionId);
      return row ? refreshRow(row, validatedSource) : true;
    })().catch((error) => {
      // Repeating an unexpected failure on every asset request would not fix it.
      input.onError?.(error);
      return true;
    });
    // Asset requests wait for all builds, while watcher refreshes can finish independently.
    const completion = Promise.all([previous, work]).then(([, complete]) => {
      if (pending.get(installedExtensionId) !== completion) return;
      pending.delete(installedExtensionId);
      // A source that failed to load stays unchecked, so a later asset request can load it again.
      if (!disposed && complete) checked.add(installedExtensionId);
    });
    pending.set(installedExtensionId, completion);
    return work;
  };

  const ensure = (installedExtensionId: string) => {
    if (disposed) return Promise.resolve();
    const running = pending.get(installedExtensionId);
    if (running) return running;
    if (checked.has(installedExtensionId)) return Promise.resolve();
    check(installedExtensionId);
    return pending.get(installedExtensionId)!;
  };

  const refresh = async (sourcePath?: string, validatedSource?: LoadedExtension) => {
    if (disposed) return;
    try {
      const rows = await input.listInstalledSources();
      if (!sourcePath)
        removeUnownedWebviewBuilds(
          webviewCacheRoot,
          rows.map((row) => row.id),
        );
      await Promise.all(
        rows
          .filter((row) => !sourcePath || row.source_path === sourcePath)
          .map((row) => {
            // A refresh asks for the source to be read again, and some changes, such as a rebuilt
            // linked dependency, leave the load key unchanged. So a refresh always loads.
            checked.delete(row.id);
            backoff.forget(row.id);
            return check(row.id, validatedSource);
          }),
      );
    } catch (error) {
      input.onError?.(error);
    }
  };

  const dispose = () => {
    disposed = true;
    for (const controller of activeBuilds) controller.abort();
    activeBuilds.clear();
    building.clear();
    checked.clear();
    pending.clear();
    backoff.clear();
  };

  return { dispose, ensure, refresh };
};
