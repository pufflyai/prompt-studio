import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type LoadedExtension, loadExtensionSource } from "./extension-runtime";
import { createWebviewBuildBackoff, processKey, signatureFor } from "./extension-webview-build-backoff";
import {
  prepareWebviewBuildCache,
  publishedWebviewModule,
  readWebviewBuildSignature,
  removeUnownedWebviewBuilds,
} from "./extension-webview-build-cache";
import { defaultWebviewCacheRoot } from "./extension-webview-build-paths";
import {
  type CreateExtensionWebviewBuildManagerInput,
  createBuildReporters,
} from "./extension-webview-build-reporters";
import {
  expectedWebviewBuildSource,
  type InstalledSourceWithManifest,
  runExtensionWebviewBuild,
  webviewBuildFailure,
} from "./extension-webview-build-runner";
import { inspectManagedWebviewBuildInputs, prepareManagedWebviewBuildSource } from "./extension-webview-build-source";
import { buildExtensionWebview } from "./extension-webview-builder";
import { loadWebviewSource } from "./extension-webview-source-load";
import {
  classifyWebviewEntry,
  collectExtensionWebviews,
  resolveManagedWebviewPaths,
  resolvePackageAssetFile,
} from "./extension-webviews";

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

// Finished builds report success or failure against the owner of the same inputs.
const findCurrentBuildSource = async (
  listInstalledSources: () => Promise<InstalledSourceWithManifest[]>,
  row: InstalledSourceWithManifest,
  signature: string,
  packageName: string,
  webview: ManagedWebview,
  loadSource: typeof loadExtensionSource,
) => {
  const currentRow = (await listInstalledSources()).find((current) => current.id === row.id);
  if (!currentRow || currentRow.source_path !== row.source_path) return null;

  let currentView = webview;
  if (currentRow.source_hash !== row.source_hash) {
    const loaded = await loadSource(currentRow.source_path);
    // Invalid source leaves the last accepted declaration active.
    if (!loaded.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      const declared = collectExtensionWebviews(loaded).find((view) => view.id === webview.id);
      if (!declared || resolvePackageAssetFile(declared.entry) !== resolvePackageAssetFile(webview.entry)) return null;
      currentView = declared;
      packageName = loaded.metadata.name;
    }
  }
  const current = inspectWebviewBuild(currentRow, packageName, currentView);
  return current.signature === signature ? currentRow : null;
};

const isPublished = (webviewCacheRoot: string, installedExtensionId: string, webviewId: string) => {
  const { distDir } = resolveManagedWebviewPaths({ installedExtensionId, webviewCacheRoot, webviewId });
  return existsSync(publishedWebviewModule(distDir));
};

const publishCompletedBuild = async (
  row: InstalledSourceWithManifest,
  result: Extract<WebviewBuildResult, { builtNow: true }>,
  reportSuccess: ReturnType<typeof createBuildReporters>["reportSuccess"],
) => {
  rmSync(result.distDir, { recursive: true, force: true });
  renameSync(result.stageDir, result.distDir);
  return reportSuccess(row.id, result.webviewId, { sourcePath: row.source_path });
};

export const createExtensionWebviewBuildManager = (input: CreateExtensionWebviewBuildManagerInput) => {
  const building = new Map<string, string>();
  // The managed webviews that the last complete check of each installed extension found.
  const checked = new Map<string, Set<string>>();
  const pending = new Map<string, Promise<void>>();
  const activeStages = new Set<string>();
  const backoff = createWebviewBuildBackoff();
  const activeBuilds = new Set<AbortController>();
  let disposed = false;
  const buildWebview = input.buildWebview ?? buildExtensionWebview;
  const loadSource = input.loadSource ?? loadExtensionSource;
  const webviewCacheRoot = input.webviewCacheRoot ?? defaultWebviewCacheRoot(process.env);
  const { reportFailure, reportSuccess } = createBuildReporters(input);

  const buildNewManagedWebview = async (build: {
    buildInputs: ReturnType<typeof inspectManagedWebviewBuildInputs>;
    key: string;
    packageName: string;
    row: InstalledSourceWithManifest;
    signature: string;
    sourceEntryPath: string;
    webview: ManagedWebview;
  }) => {
    const { buildInputs, key, packageName, row, signature, sourceEntryPath, webview } = build;
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

    const reportCurrentFailure = async (error: unknown) => {
      const currentRow = await findCurrentBuildSource(
        input.listInstalledSources,
        row,
        signature,
        packageName,
        webview,
        loadSource,
      );
      if (currentRow && !disposed && building.get(key) === signature)
        await reportFailure(currentRow.id, webview.id, error, expectedWebviewBuildSource(currentRow));
    };

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
          await reportCurrentFailure(webviewBuildFailure(row.install_name, webview.id, buildSource.details));
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
        reportFailure: (_id, _webviewId, error) => reportCurrentFailure(error),
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

  // Resolves with the managed webview ids once the source loaded and every build was attempted.
  const refreshRow = async (row: InstalledSourceWithManifest, validatedSource?: LoadedExtension) => {
    if (disposed) return null;
    const loaded = validatedSource ?? (await loadWebviewSource({ backoff, loadSource, onError: input.onError, row }));
    if (!loaded || disposed) return null;

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
          const currentRow = await findCurrentBuildSource(
            input.listInstalledSources,
            row,
            result.signature,
            loaded.metadata.name,
            webview,
            loadSource,
          );
          if (!currentRow || disposed || building.get(key) !== result.signature) return;

          if (await publishCompletedBuild(currentRow, result, reportSuccess)) backoff.forget(result.key);
        } finally {
          rmSync(result.stageDir, { recursive: true, force: true });
          activeStages.delete(result.stageDir);
          if (building.get(key) === result.signature) building.delete(key);
        }
      }),
    );
    return managedWebviews.map((webview) => webview.id);
  };

  const check = (installedExtensionId: string, validatedSource?: LoadedExtension) => {
    const previous = pending.get(installedExtensionId);
    const work = (async () => {
      if (disposed) return null;
      const row = (await input.listInstalledSources()).find((row) => row.id === installedExtensionId);
      return row ? refreshRow(row, validatedSource) : [];
    })().catch((error) => {
      // Repeating an unexpected failure on every asset request would not fix it.
      input.onError?.(error);
      return [];
    });
    // Asset requests wait for all builds, while watcher refreshes can finish independently.
    const completion = Promise.all([previous, work]).then(([, webviewIds]) => {
      if (pending.get(installedExtensionId) !== completion) return;
      pending.delete(installedExtensionId);
      // A source that failed to load stays unchecked, so a later asset request can load it again.
      if (!disposed && webviewIds) checked.set(installedExtensionId, new Set(webviewIds));
    });
    pending.set(installedExtensionId, completion);
    return work;
  };

  // A checked webview whose bundle is gone, for example after its cache folder was removed, needs
  // another check. A recorded build failure keeps its error until the build inputs change.
  const ensure = (installedExtensionId: string, webviewId?: string) => {
    if (disposed) return Promise.resolve();
    const running = pending.get(installedExtensionId);
    if (running) return running;
    const repair =
      webviewId !== undefined &&
      checked.get(installedExtensionId)?.has(webviewId) === true &&
      !backoff.hasFailure(processKey(installedExtensionId, webviewId)) &&
      !isPublished(webviewCacheRoot, installedExtensionId, webviewId);
    if (checked.has(installedExtensionId) && !repair) return Promise.resolve();
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
            // Refreshing one source, after an install, a Reload, or a change in its folder, asks for it
            // to be read and built again. Some causes, such as a rebuilt linked dependency or a build
            // process that was stopped, leave the load key and build signatures unchanged.
            checked.delete(row.id);
            if (sourcePath) backoff.forgetExtension(row.id);
            else backoff.forget(row.id);
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
