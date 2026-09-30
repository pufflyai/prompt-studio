import { renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type LoadedExtension, loadExtensionSource } from "./extension-runtime";
import { createWebviewBuildBackoff, processKey, signatureFor } from "./extension-webview-build-backoff";
import {
  prepareWebviewBuildCache,
  readWebviewBuildSignature,
  removeUnownedWebviewBuilds,
} from "./extension-webview-build-cache";
import { createWebviewBuildChecks } from "./extension-webview-build-checks";
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

const managedWebviewsOf = (loaded: LoadedExtension) =>
  collectExtensionWebviews(loaded).filter((webview) => classifyWebviewEntry(webview.entry).kind === "managed");

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
  const checks = createWebviewBuildChecks();
  const activeStages = new Set<string>();
  const backoff = createWebviewBuildBackoff();
  const activeBuilds = new Set<AbortController>();
  let disposed = false;
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
    building.set(key, signature);
    backoff.recordBuildStart(key);
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
    if (await reportSuccess(row.id, result.webviewId, expectedSource)) {
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
    const currentRow = currentRows.find((current) => current.id === row.id);
    if (!currentRow || currentRow.source_path !== row.source_path) return null;

    const current = inspectWebviewBuild(currentRow, packageName, webview);
    return current.signature === result.signature ? currentRow : null;
  };

  const refreshRow = async (
    row: InstalledSourceWithManifest,
    webviewIds: string[],
    validatedSource?: LoadedExtension,
  ) => {
    if (disposed) return;
    const loaded = validatedSource ?? (await loadExtensionSource(row.source_path));
    if (disposed) return;

    const managedWebviews = managedWebviewsOf(loaded).filter((webview) => webviewIds.includes(webview.id));
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
  };

  const check = (installedExtensionId: string, webviewIds: string[], validatedSource?: LoadedExtension) => {
    const work = (async () => {
      if (disposed) return;
      const row = (await input.listInstalledSources()).find((row) => row.id === installedExtensionId);
      if (row) await refreshRow(row, webviewIds, validatedSource);
    })().catch((error) => input.onError?.(error));
    checks.track(installedExtensionId, webviewIds, work);
    return work;
  };

  // A webview is used when its assets are requested. Building only that webview keeps its
  // first render from waiting behind webviews nobody opened.
  const ensure = (installedExtensionId: string, webviewId: string) => {
    if (disposed) return Promise.resolve();
    return checks.use(installedExtensionId, webviewId, () => check(installedExtensionId, [webviewId]));
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
            const usedWebviewIds = checks.reset(row.id);
            // An explicit reload validates the source, so it builds every webview at once to report errors.
            const webviewIds = validatedSource
              ? managedWebviewsOf(validatedSource).map((webview) => webview.id)
              : usedWebviewIds;
            if (webviewIds.length > 0) return check(row.id, webviewIds, validatedSource);
            return undefined;
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
    checks.clear();
    backoff.clear();
  };

  return { dispose, ensure, refresh };
};
