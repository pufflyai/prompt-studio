import { renameSync, rmSync } from "node:fs";
import { loadExtensionSource } from "./extension-runtime";
import { createWebviewBuildBackoff, processKey, signatureFor } from "./extension-webview-build-backoff";
import { defaultWebviewCacheRoot } from "./extension-webview-build-paths";
import { inspectManagedWebviewBuildInputs, prepareManagedWebviewBuildSource } from "./extension-webview-build-source";
import { buildExtensionWebview, type ExtensionWebviewBuilder } from "./extension-webview-builder";
import {
  classifyWebviewEntry,
  collectExtensionWebviews,
  resolveManagedWebviewPaths,
  resolvePackageAssetFile,
} from "./extension-webviews";

type InstalledSourceWithManifest = {
  install_name: string;
  source_hash?: string | null;
  source_path: string;
};

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

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const buildFailure = (installName: string, webviewId: string, details: string) =>
  new Error(`Webview build failed for ${installName}/${webviewId}${details ? `: ${details}` : ""}`);

const clearBuildState = (
  activeBuilds: Set<AbortController>,
  built: Map<string, string>,
  backoff: ReturnType<typeof createWebviewBuildBackoff>,
) => {
  activeBuilds.clear();
  built.clear();
  backoff.clear();
};

type ManagedWebview = ReturnType<typeof collectExtensionWebviews>[number];
type LoadedExtensionSource = Awaited<ReturnType<typeof loadExtensionSource>>;

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

export const createExtensionWebviewBuildManager = (input: CreateExtensionWebviewBuildManagerInput) => {
  const built = new Map<string, string>();
  const backoff = createWebviewBuildBackoff();
  const activeBuilds = new Set<AbortController>();
  let disposed = false;
  let refreshQueue = Promise.resolve();
  const buildWebview = input.buildWebview ?? buildExtensionWebview;
  const webviewCacheRoot = input.webviewCacheRoot ?? defaultWebviewCacheRoot(process.env);

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

  const buildOnce = async (row: InstalledSourceWithManifest, webviewId: string, entryPath: string, distDir: string) => {
    if (disposed) return false;

    const controller = new AbortController();
    activeBuilds.add(controller);
    let result: Awaited<ReturnType<ExtensionWebviewBuilder>>;
    try {
      result = await buildWebview({ entryPath, outdir: distDir, signal: controller.signal });
    } catch (error) {
      if (!disposed) {
        await reportFailure(
          row.install_name,
          webviewId,
          buildFailure(row.install_name, webviewId, errorMessage(error)),
          {
            sourceHash: row.source_hash,
            sourcePath: row.source_path,
          },
        );
      }
      return false;
    } finally {
      activeBuilds.delete(controller);
    }

    if (result.success) {
      return true;
    }

    if (!disposed) {
      await reportFailure(row.install_name, webviewId, buildFailure(row.install_name, webviewId, result.details), {
        sourceHash: row.source_hash,
        sourcePath: row.source_path,
      });
    }
    return false;
  };

  const buildManagedWebview = async (input: {
    packageName: string;
    row: InstalledSourceWithManifest;
    webview: ManagedWebview;
  }): Promise<WebviewBuildResult | null> => {
    const { packageName, row, webview } = input;
    const key = processKey(row.install_name, webview.id);
    const sourceEntryPath = resolvePackageAssetFile(webview.entry);
    const buildInputs = inspectManagedWebviewBuildInputs({
      entryPath: sourceEntryPath,
      installName: row.install_name,
      packageName,
      packagePath: row.source_path,
    });
    const signature = signatureFor(row, webview.id, webview.entry.path, buildInputs.signature);
    if (built.get(key) === signature) return { builtNow: false, key, signature, webviewId: webview.id };
    if (backoff.isBuildBlocked(key, signature)) return null;

    built.delete(key);
    backoff.recordBuildStart(key);
    const paths = resolveManagedWebviewPaths({
      installName: row.install_name,
      webviewCacheRoot,
      webviewId: webview.id,
    });
    const stageDir = `${paths.distDir}.staging-${crypto.randomUUID()}`;
    rmSync(stageDir, { recursive: true, force: true });

    const buildSource = prepareManagedWebviewBuildSource({
      buildInputs,
      entryPath: sourceEntryPath,
      installName: row.install_name,
      packageName,
      packagePath: row.source_path,
      shellDir: paths.shellDir,
    });
    if (!buildSource.success) {
      await reportFailure(
        row.install_name,
        webview.id,
        buildFailure(row.install_name, webview.id, buildSource.details),
        { sourceHash: row.source_hash, sourcePath: row.source_path },
      );
      backoff.recordBuildFailure(key, signature);
      return null;
    }

    const builtSuccessfully = await buildOnce(row, webview.id, buildSource.entryPath, stageDir);
    if (!builtSuccessfully || disposed) {
      if (!disposed) backoff.recordBuildFailure(key, signature);
      rmSync(stageDir, { recursive: true, force: true });
      return null;
    }

    return { builtNow: true, distDir: paths.distDir, key, signature, stageDir, webviewId: webview.id };
  };

  const buildManagedWebviews = (input: {
    active: Set<string>;
    loaded: LoadedExtensionSource;
    managedWebviews: ManagedWebview[];
    row: InstalledSourceWithManifest;
  }) =>
    Promise.all(
      input.managedWebviews.map(async (webview) => {
        const key = processKey(input.row.install_name, webview.id);
        input.active.add(key);
        return buildManagedWebview({ packageName: input.loaded.metadata.name, row: input.row, webview });
      }),
    );

  const removeStagedBuilds = (buildResults: Array<WebviewBuildResult | null>) => {
    for (const result of buildResults) {
      if (result && "stageDir" in result) rmSync(result.stageDir, { recursive: true, force: true });
    }
  };

  const hasObsoleteCachedBuild = (completedBuilds: WebviewBuildResult[]) =>
    completedBuilds.some((result) => !result.builtNow && built.get(result.key) !== result.signature);

  const publishCompletedBuilds = async (row: InstalledSourceWithManifest, completedBuilds: WebviewBuildResult[]) => {
    for (const result of completedBuilds) {
      if (!result.builtNow || !result.distDir || !result.stageDir) continue;
      rmSync(result.distDir, { recursive: true, force: true });
      renameSync(result.stageDir, result.distDir);
    }

    const expectedSource = { sourceHash: row.source_hash, sourcePath: row.source_path };
    for (const result of completedBuilds) {
      if (!result.builtNow) continue;
      if (await reportSuccess(row.install_name, result.webviewId, expectedSource)) {
        built.set(result.key, result.signature);
        backoff.recordBuildSuccess(result.key);
      }
    }
  };

  const sourceStillCurrent = async (row: InstalledSourceWithManifest) => {
    const currentRows = await input.listInstalledSources();
    const currentRow = currentRows.find((current) => current.install_name === row.install_name);
    return currentRow?.source_hash === row.source_hash && currentRow?.source_path === row.source_path;
  };

  const refreshRow = async (row: InstalledSourceWithManifest, active: Set<string>) => {
    if (disposed) return;
    const loaded = await loadExtensionSource(row.source_path);
    if (disposed) return;

    const managedWebviews = collectExtensionWebviews(loaded).filter(
      (webview) => classifyWebviewEntry(webview.entry).kind === "managed",
    );

    const buildResults = await buildManagedWebviews({ active, loaded, managedWebviews, row });

    const completedBuilds = buildResults.filter((result): result is NonNullable<typeof result> => result !== null);
    if (disposed || completedBuilds.length !== managedWebviews.length) {
      removeStagedBuilds(buildResults);
      return;
    }
    if (!completedBuilds.some((result) => result.builtNow)) return;
    if (hasObsoleteCachedBuild(completedBuilds)) return;

    try {
      if (!(await sourceStillCurrent(row))) {
        removeStagedBuilds(buildResults);
        return;
      }
    } catch (error) {
      removeStagedBuilds(buildResults);
      throw error;
    }

    await publishCompletedBuilds(row, completedBuilds);
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

  const refresh = () => {
    const nextRefresh = refreshQueue.then(refreshNow, refreshNow);
    refreshQueue = nextRefresh.catch(() => {});
    return nextRefresh;
  };

  const dispose = () => {
    disposed = true;
    for (const controller of activeBuilds) controller.abort();
    clearBuildState(activeBuilds, built, backoff);
  };

  return { dispose, refresh };
};
