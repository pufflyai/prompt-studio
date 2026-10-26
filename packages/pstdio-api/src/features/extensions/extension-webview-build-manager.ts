import { type LoadedExtensionSnapshot, loadExtensionSource } from "./extension-runtime";
import {
  createManagedWebviewBuilder,
  findCurrentBuildSource,
  inspectWebviewBuild,
  isWebviewPublished,
  type ManagedWebviewBuildIdentity,
  type ManagedWebviewBuildResult,
} from "./extension-webview-build-attempt";
import { createWebviewBuildBackoff, processKey } from "./extension-webview-build-backoff";
import { readWebviewBuildSignature, removeUnownedWebviewBuilds } from "./extension-webview-build-cache";
import { defaultWebviewCacheRoot } from "./extension-webview-build-paths";
import {
  type CreateExtensionWebviewBuildManagerInput,
  createBuildReporters,
} from "./extension-webview-build-reporters";
import { expectedWebviewBuildSource, type InstalledSourceWithManifest } from "./extension-webview-build-runner";
import { buildExtensionWebview } from "./extension-webview-builder";
import { loadCurrentWebviewSource } from "./extension-webview-source-load";
import {
  type CollectedExtensionWebview,
  classifyWebviewEntry,
  collectExtensionWebviews,
  resolveManagedWebviewPaths,
} from "./extension-webviews";

interface BuildAttempt extends ManagedWebviewBuildIdentity {
  controller: AbortController;
  users: number;
  work: Promise<ManagedWebviewBuildResult> | ManagedWebviewBuildResult;
}

const cancelBuildAttempts = (
  attempts: Map<string, BuildAttempt>,
  shouldCancel: (attempt: BuildAttempt, key: string) => boolean,
) => {
  for (const [key, attempt] of attempts) {
    if (!shouldCancel(attempt, key)) continue;
    attempt.controller.abort();
    attempts.delete(key);
  }
};

export const createExtensionWebviewBuildManager = (input: CreateExtensionWebviewBuildManagerInput) => {
  const attempts = new Map<string, BuildAttempt>();
  const checked = new Map<string, Set<string>>();
  const pending = new Map<string, Promise<void>>();
  const activeStages = new Set<string>();
  const activeBuilds = new Set<AbortController>();
  const backoff = createWebviewBuildBackoff();
  let disposed = false;
  const loadSource = input.loadSource ?? loadExtensionSource;
  const webviewCacheRoot = input.webviewCacheRoot ?? defaultWebviewCacheRoot(process.env);
  const { reportResult } = createBuildReporters(input);
  const loadCurrentSource = (installedExtensionId: string, validatedSource?: LoadedExtensionSnapshot) =>
    loadCurrentWebviewSource({
      backoff,
      installedExtensionId,
      listInstalledSources: input.listInstalledSources,
      loadSource,
      onError: input.onError,
      validatedSource,
    });
  const findCurrentSource = (identity: ManagedWebviewBuildIdentity) =>
    findCurrentBuildSource(loadCurrentSource, identity);
  const build = createManagedWebviewBuilder({
    activeBuilds,
    activeStages,
    buildWebview: input.buildWebview ?? buildExtensionWebview,
    findCurrentSource,
    webviewCacheRoot,
  });

  const reconcileResult = async (key: string, attempt: BuildAttempt, result: ManagedWebviewBuildResult) => {
    if (result.status === "unavailable") return;
    const isCurrent = () => !disposed && attempts.get(key) === attempt;
    while (isCurrent()) {
      const { row, signature, webview } = attempt;
      const current = await findCurrentSource(attempt);
      if (!current || !isCurrent()) return;
      const expected = expectedWebviewBuildSource(current);
      const outcome = await reportResult(row.id, webview.id, result, expected);
      // A conditional-write conflict reuses the finished result; it never runs the build again.
      if (outcome === "source-changed") continue;
      if (outcome === "failed") throw new Error(`Could not record webview build result: ${webview.id}`);
      if (outcome === "reported" && result.status === "failure" && isCurrent()) {
        backoff.recordFailure(key, signature);
      }
      return;
    }
  };

  const buildManagedWebview = async (
    row: InstalledSourceWithManifest,
    snapshot: LoadedExtensionSnapshot,
    webview: CollectedExtensionWebview,
    validatedSource?: LoadedExtensionSnapshot,
  ) => {
    const key = processKey(row.id, webview.id);
    const inspected = inspectWebviewBuild(row, snapshot.loaded.metadata.name, webview);
    const { signature } = inspected;
    const paths = resolveManagedWebviewPaths({ installedExtensionId: row.id, webviewCacheRoot, webviewId: webview.id });
    let attempt = attempts.get(key);
    if (attempt?.signature === signature) {
      // A watcher refresh does not wait for an unchanged sibling. A source adoption must
      // reconcile its own state, including when Reload adopts the same hash again.
      if (!validatedSource && attempt.work instanceof Promise && attempt.row.source_hash === row.source_hash) return;
    } else {
      const previous = attempt;
      if (previous) {
        previous.controller.abort();
        attempts.delete(key);
      }
      if (readWebviewBuildSignature(paths.distDir) === signature || backoff.isBlocked(key, signature)) return;
      backoff.forget(key);
      const created: BuildAttempt = {
        controller: new AbortController(),
        row,
        webview,
        snapshot,
        signature,
        users: 0,
        work: Promise.resolve()
          .then(async () => {
            const result = await build({
              ...inspected,
              row,
              snapshot,
              webview,
              signal: created.controller.signal,
              isCurrent: () => !disposed && attempts.get(key) === created,
            });
            created.work = result;
            return result;
          })
          .catch((error) => {
            if (attempts.get(key) === created) attempts.delete(key);
            throw error;
          }),
      };
      attempts.set(key, created);
      attempt = created;
    }
    attempt.users++;
    try {
      await reconcileResult(key, attempt, await attempt.work);
    } finally {
      attempt.users--;
    }
    if (attempt.users === 0 && attempts.get(key) === attempt) attempts.delete(key);
  };

  const retireRemovedViews = (installedExtensionId: string, webviews: CollectedExtensionWebview[]) => {
    const keys = new Set(webviews.map((view) => processKey(installedExtensionId, view.id)));
    cancelBuildAttempts(attempts, (attempt, key) => attempt.row.id === installedExtensionId && !keys.has(key));
  };

  const refreshRow = async (installedExtensionId: string, validatedSource?: LoadedExtensionSnapshot) => {
    if (disposed) return null;
    const current = await loadCurrentSource(installedExtensionId, validatedSource);
    if (!current || disposed) return null;
    const { row, snapshot } = current;
    const webviews = collectExtensionWebviews(snapshot.loaded).filter(
      (view) => classifyWebviewEntry(view.entry).kind === "managed",
    );
    if (validatedSource) retireRemovedViews(row.id, webviews);
    const results = await Promise.allSettled(
      webviews.map((view) => buildManagedWebview(row, snapshot, view, validatedSource)),
    );
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
    }
    return webviews.map((view) => view.id);
  };

  const check = (installedExtensionId: string, validatedSource?: LoadedExtensionSnapshot) => {
    const previous = pending.get(installedExtensionId);
    const work = (async () => {
      if (disposed) return null;
      return refreshRow(installedExtensionId, validatedSource);
    })();
    const completion = Promise.allSettled([previous, work])
      .then(([earlier, current]) => {
        if (earlier.status === "rejected") throw earlier.reason;
        if (current.status === "rejected") throw current.reason;
        const webviewIds = current.value;
        if (!disposed && pending.get(installedExtensionId) === completion && webviewIds) {
          checked.set(installedExtensionId, new Set(webviewIds));
        }
      })
      .finally(() => {
        if (pending.get(installedExtensionId) === completion) pending.delete(installedExtensionId);
      });
    pending.set(installedExtensionId, completion);
    // Refresh callers await their own work; requests await all overlapping work.
    void completion.catch(() => {});
    return work;
  };

  const ensure = (installedExtensionId: string, webviewId?: string) => {
    if (disposed) return Promise.resolve();
    const running = pending.get(installedExtensionId);
    if (running) return running;
    const repair =
      webviewId !== undefined &&
      checked.get(installedExtensionId)?.has(webviewId) === true &&
      !backoff.hasFailure(processKey(installedExtensionId, webviewId)) &&
      !isWebviewPublished(webviewCacheRoot, installedExtensionId, webviewId);
    if (checked.has(installedExtensionId) && !repair) return Promise.resolve();
    checked.delete(installedExtensionId);
    check(installedExtensionId);
    return pending.get(installedExtensionId)!;
  };

  const refreshSources = async (sourcePath?: string, validatedSource?: LoadedExtensionSnapshot) => {
    if (disposed) return;
    const rows = await input.listInstalledSources();
    const installedIds = new Set(rows.map((row) => row.id));
    cancelBuildAttempts(attempts, (attempt) => !installedIds.has(attempt.row.id));
    if (!sourcePath)
      removeUnownedWebviewBuilds(
        webviewCacheRoot,
        rows.map((row) => row.id),
      );
    await Promise.all(
      rows
        .filter((row) => !sourcePath || row.source_path === sourcePath)
        .map((row) => {
          checked.delete(row.id);
          if (sourcePath) backoff.forgetExtension(row.id);
          else backoff.forget(row.id);
          return check(row.id, validatedSource);
        }),
    );
  };

  const refresh = async (sourcePath?: string) => {
    try {
      await refreshSources(sourcePath);
    } catch (error) {
      input.onError?.(error);
    }
  };

  const adopt = async (sourcePath: string, validatedSource?: LoadedExtensionSnapshot) => {
    if (disposed) return;
    const row = (await input.listInstalledSources()).find((row) => row.source_path === sourcePath);
    if (!row) return;
    backoff.forgetExtension(row.id);
    const current = await loadCurrentSource(row.id, validatedSource);
    if (current) await refreshSources(current.row.source_path, current.snapshot);
  };

  const dispose = () => {
    disposed = true;
    for (const attempt of attempts.values()) attempt.controller.abort();
    for (const controller of activeBuilds) controller.abort();
    activeBuilds.clear();
    attempts.clear();
    checked.clear();
    pending.clear();
    backoff.clear();
  };
  return { adopt, dispose, ensure, refresh };
};
