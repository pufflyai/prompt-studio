import { existsSync, renameSync, rmSync } from "node:fs";
import { type LoadedExtension, loadExtensionSource } from "./extension-runtime";
import { createWebviewBuildBackoff, processKey, signatureFor } from "./extension-webview-build-backoff";
import { defaultWebviewCacheRoot } from "./extension-webview-build-paths";
import {
  expectedWebviewBuildSource,
  type InstalledSourceWithManifest,
  runExtensionWebviewBuild,
  webviewBuildFailure,
} from "./extension-webview-build-runner";
import { inspectManagedWebviewBuildInputs, prepareManagedWebviewBuildSource } from "./extension-webview-build-source";
import { buildExtensionWebview, type ExtensionWebviewBuilder } from "./extension-webview-builder";
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
  onError?: (error: unknown) => void;
  reportBuildFailure: (
    installName: string,
    webviewId: string,
    error: unknown,
    expectedSource: ExpectedWebviewBuildSource,
  ) => Promise<unknown>;
  reportBuildSuccess: (
    installName: string,
    webviewId: string,
    expectedSource: ExpectedWebviewBuildSource,
  ) => Promise<unknown>;
  webviewCacheRoot?: string;
};

const clearBuildState = (
  activeBuilds: Set<AbortController>,
  built: Map<string, string>,
  building: Map<string, string>,
  backoff: ReturnType<typeof createWebviewBuildBackoff>,
) => {
  activeBuilds.clear();
  built.clear();
  building.clear();
  backoff.clear();
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
    installName: string,
    webviewId: string,
    error: unknown,
    expectedSource: ExpectedWebviewBuildSource,
  ) => {
    try {
      await input.reportBuildFailure(installName, webviewId, error, expectedSource);
    } catch (reportError) {
      input.onError?.(reportError);
    }
  };

  const reportSuccess = async (installName: string, webviewId: string, expectedSource: ExpectedWebviewBuildSource) => {
    try {
      await input.reportBuildSuccess(installName, webviewId, expectedSource);
      return true;
    } catch (reportError) {
      input.onError?.(reportError);
      return false;
    }
  };

  return { reportFailure, reportSuccess };
};

export const createExtensionWebviewBuildManager = (input: CreateExtensionWebviewBuildManagerInput) => {
  const built = new Map<string, string>(),
    building = new Map<string, string>();
  const backoff = createWebviewBuildBackoff();
  const activeBuilds = new Set<AbortController>();
  let disposed = false,
    refreshQueue = Promise.resolve();
  const buildWebview = input.buildWebview ?? buildExtensionWebview;
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
    built.delete(key);
    building.set(key, signature);
    backoff.recordBuildStart(key);
    const paths = resolveManagedWebviewPaths({
      installName: row.install_name,
      webviewCacheRoot,
      webviewId: webview.id,
    });
    const stageDir = `${paths.distDir}.staging-${crypto.randomUUID()}`;
    rmSync(stageDir, { recursive: true, force: true });

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
            row.install_name,
            webview.id,
            webviewBuildFailure(row.install_name, webview.id, buildSource.details),
            expectedWebviewBuildSource(row),
          );
          backoff.recordBuildFailure(key, signature);
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
          backoff.recordBuildFailure(key, signature);
        }
        rmSync(stageDir, { recursive: true, force: true });
        return null;
      }

      readyForPublish = true;
      return { builtNow: true, distDir: paths.distDir, key, signature, stageDir, webviewId: webview.id };
    } finally {
      if (!readyForPublish && building.get(key) === signature) building.delete(key);
    }
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

  const buildManagedWebview = async (input: {
    packageName: string;
    row: InstalledSourceWithManifest;
    webview: ManagedWebview;
  }): Promise<WebviewBuildResult | null> => {
    const { packageName, row, webview } = input;
    const key = processKey(row.install_name, webview.id);
    const { buildInputs, signature, sourceEntryPath } = inspectWebviewBuild(row, packageName, webview);
    const paths = resolveManagedWebviewPaths({
      installName: row.install_name,
      webviewCacheRoot,
      webviewId: webview.id,
    });
    if (built.get(key) === signature && existsSync(paths.distDir)) {
      return { builtNow: false, key, signature, webviewId: webview.id };
    }
    if (building.get(key) === signature) return { builtNow: false, key, signature, webviewId: webview.id };
    if (backoff.isBuildBlocked(key, signature)) return null;
    return buildNewManagedWebview({ buildInputs, key, packageName, row, signature, sourceEntryPath, webview });
  };

  const publishCompletedBuild = async (
    row: InstalledSourceWithManifest,
    result: Extract<WebviewBuildResult, { builtNow: true }>,
  ) => {
    rmSync(result.distDir, { recursive: true, force: true });
    renameSync(result.stageDir, result.distDir);
    const expectedSource = { sourcePath: row.source_path };
    if (await reportSuccess(row.install_name, result.webviewId, expectedSource)) {
      built.set(result.key, result.signature);
      backoff.recordBuildSuccess(result.key);
    }
  };

  const findCurrentBuildSource = async (
    row: InstalledSourceWithManifest,
    result: Extract<WebviewBuildResult, { builtNow: true }>,
    packageName: string,
    webview: ManagedWebview,
  ) => {
    const currentRows = await input.listInstalledSources();
    const currentRow = currentRows.find((current) => current.install_name === row.install_name);
    if (!currentRow || currentRow.source_path !== row.source_path) return null;

    const current = inspectWebviewBuild(currentRow, packageName, webview);
    return current.signature === result.signature ? currentRow : null;
  };

  const refreshRow = async (
    row: InstalledSourceWithManifest,
    active: Set<string>,
    validatedSource?: LoadedExtension,
  ) => {
    if (disposed) return;
    const loaded = validatedSource ?? (await loadExtensionSource(row.source_path));
    if (disposed) return;

    const managedWebviews = collectExtensionWebviews(loaded).filter(
      (webview) => classifyWebviewEntry(webview.entry).kind === "managed",
    );
    await Promise.all(
      managedWebviews.map(async (webview) => {
        const key = processKey(row.install_name, webview.id);
        active.add(key);
        const result = await buildManagedWebview({ packageName: loaded.metadata.name, row, webview });
        if (!result?.builtNow) return;
        try {
          if (disposed || building.get(key) !== result.signature) return;
          const currentRow = await findCurrentBuildSource(row, result, loaded.metadata.name, webview);
          if (!currentRow || disposed || building.get(key) !== result.signature) return;

          await publishCompletedBuild(currentRow, result);
        } finally {
          rmSync(result.stageDir, { recursive: true, force: true });
          if (building.get(key) === result.signature) building.delete(key);
        }
      }),
    );
  };

  const refreshSource = async (sourcePath: string, validatedSource?: LoadedExtension) => {
    if (disposed) return;
    const rows = (await input.listInstalledSources()).filter((row) => row.source_path === sourcePath);
    await Promise.all(
      rows.map(async (row) => {
        try {
          await refreshRow(row, new Set(), validatedSource);
        } catch (error) {
          input.onError?.(error);
        }
      }),
    );
  };

  const refreshNow = async () => {
    if (disposed) return;

    const active = new Set<string>();
    const rows = await input.listInstalledSources();

    await Promise.all(
      rows.map(async (row) => {
        if (disposed) return;
        try {
          await refreshRow(row, active);
        } catch (error) {
          input.onError?.(error);
        }
      }),
    );

    for (const key of built.keys()) {
      if (active.has(key)) continue;

      built.delete(key);
      const [installName, webviewId] = key.split("\0");
      if (installName && webviewId) {
        const paths = resolveManagedWebviewPaths({ installName, webviewCacheRoot, webviewId });
        rmSync(paths.distDir, { recursive: true, force: true });
      }
    }
  };

  const refresh = (sourcePath?: string, validatedSource?: LoadedExtension) => {
    if (sourcePath) return refreshSource(sourcePath, validatedSource);
    const nextRefresh = refreshQueue.then(refreshNow, refreshNow);
    refreshQueue = nextRefresh.catch(() => {});
    return nextRefresh;
  };

  const dispose = () => {
    disposed = true;
    for (const controller of activeBuilds) controller.abort();
    clearBuildState(activeBuilds, built, building, backoff);
  };

  return { dispose, refresh };
};
