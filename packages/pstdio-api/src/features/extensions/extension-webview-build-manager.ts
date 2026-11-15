import {
  acceptPreparedRevision,
  preparedRevisionState,
  readAcceptedRevision,
  withBackgroundPreparation,
} from "pstdio-extensions";
import {
  hasAcceptedNativeWebviews,
  hasAcceptedWebviews,
  notifyAcceptedWebviewPublication,
  reconcileAcceptedWebviews,
} from "./accepted-webview-output";
import { createInitialWebviewCompletion } from "./complete-initial-webviews";
import type { LoadedExtensionSnapshot } from "./extension-runtime";
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
import {
  inspectWebviewLoadKey,
  inspectWebviewSource,
  isWebviewSnapshotCurrent,
} from "./extension-webview-source-inspection";
import { loadCurrentWebviewSource } from "./extension-webview-source-load";
import {
  type CollectedExtensionWebview,
  classifyWebviewEntry,
  collectExtensionWebviews,
  resolveManagedWebviewPaths,
} from "./extension-webviews";
import { createPendingWebviewChecks } from "./pending-webview-checks";

interface BuildAttempt extends ManagedWebviewBuildIdentity {
  users: number;
  work: Promise<ManagedWebviewBuildResult> | ManagedWebviewBuildResult;
}
type SourceRefresh = {
  current: NonNullable<Awaited<ReturnType<typeof loadCurrentWebviewSource>>>;
  validatedSource?: LoadedExtensionSnapshot;
  handled: boolean;
};
const retireRemovedAttempts = (
  attempts: Map<string, BuildAttempt>,
  installedExtensionId: string,
  webviews: CollectedExtensionWebview[],
) => {
  const keys = new Set(webviews.map((view) => processKey(installedExtensionId, view.id)));
  for (const [key, attempt] of attempts)
    if (attempt.row.id === installedExtensionId && !keys.has(key)) attempts.delete(key);
};

const recordAcceptedWebview = async (
  attempt: ManagedWebviewBuildIdentity,
  result: ManagedWebviewBuildResult,
  isCurrent: () => boolean,
) => {
  if (result.status !== "success" || !result.artifact) return;
  const accepted = await readAcceptedRevision(attempt.row.source_path);
  if (!isCurrent() || !accepted || accepted.id !== attempt.snapshot.loaded.preparedRevision?.id) return;
  if (!accepted.webviews?.[attempt.webview.id]) return;
  const expectedState = preparedRevisionState(accepted);
  accepted.webviews = {
    ...accepted.webviews,
    [attempt.webview.id]: { id: result.artifact.id, distDir: result.artifact.distDir },
  };
  await acceptPreparedRevision(attempt.row.source_path, accepted, { expectedState });
};
const recordBuildOutcome = async (
  backoff: ReturnType<typeof createWebviewBuildBackoff>,
  key: string,
  attempt: BuildAttempt,
  result: ManagedWebviewBuildResult,
  outcome: Awaited<ReturnType<ReturnType<typeof createBuildReporters>["reportResult"]>>,
  isCurrent: () => boolean,
) => {
  if (outcome === "failed") throw new Error(`Could not record webview build result: ${attempt.webview.id}`);
  if (outcome !== "reported" || !isCurrent()) return;
  await recordAcceptedWebview(attempt, result, isCurrent);
  if (result.status === "failure" && isCurrent()) backoff.recordFailure(key, attempt.signature);
};

// Read one source per check rather than repeatedly scanning the installed list.
const installedSourceGetter = (input: CreateExtensionWebviewBuildManagerInput) =>
  input.getInstalledSource ??
  (async (id: string) => (await input.listInstalledSources()).find((row) => row.id === id) ?? null);
const currentSourceLoader =
  (
    input: CreateExtensionWebviewBuildManagerInput,
    backoff: ReturnType<typeof createWebviewBuildBackoff>,
    loadSource: typeof inspectWebviewSource,
    getInstalledSource: ReturnType<typeof installedSourceGetter>,
    isDisposed: () => boolean,
  ) =>
  async (installedExtensionId: string, validatedSource?: LoadedExtensionSnapshot) => {
    if (isDisposed()) return null;
    const current = await loadCurrentWebviewSource({
      backoff,
      installedExtensionId,
      getInstalledSource,
      loadSource,
      onError: input.onError,
      validatedSource,
      isSnapshotCurrent: input.loadSource ? undefined : isWebviewSnapshotCurrent,
      inspectLoadKey: input.loadSource ? undefined : inspectWebviewLoadKey,
    });
    return isDisposed() ? null : current;
  };

const canRetainNativeWebviews = (
  input: CreateExtensionWebviewBuildManagerInput,
  validatedSource?: LoadedExtensionSnapshot,
) => !validatedSource && !input.loadSource && !input.buildWebview;

export const createExtensionWebviewBuildManager = (input: CreateExtensionWebviewBuildManagerInput) => {
  const attempts = new Map<string, BuildAttempt>();
  const checked = new Map<string, Set<string>>();
  const activeStages = new Set<string>();
  const activeBuilds = new Set<AbortController>();
  const backoff = createWebviewBuildBackoff();
  const completeInitialWebviews = createInitialWebviewCompletion(activeBuilds);
  let disposed = false;
  const pending = createPendingWebviewChecks((id, webviews) => {
    if (!disposed) checked.set(id, new Set(webviews));
  });
  const loadSource = input.loadSource ?? inspectWebviewSource;
  const webviewCacheRoot = input.webviewCacheRoot ?? defaultWebviewCacheRoot(process.env);
  const { reportResult } = createBuildReporters(input);
  const getInstalledSource = installedSourceGetter(input);
  const loadCurrentSource = currentSourceLoader(input, backoff, loadSource, getInstalledSource, () => disposed);
  const findCurrentSource = (identity: ManagedWebviewBuildIdentity) =>
    findCurrentBuildSource(loadCurrentSource, identity, input.loadSource ? undefined : inspectWebviewLoadKey);
  const build = createManagedWebviewBuilder({
    activeBuilds,
    activeStages,
    buildWebview: input.buildWebview ?? buildExtensionWebview,
    findCurrentSource,
    webviewCacheRoot,
    reusePreparedArtifacts: input.buildWebview === undefined,
  });

  const reconcileResult = async (key: string, attempt: BuildAttempt, result: ManagedWebviewBuildResult) => {
    if (result.status === "unavailable") return;
    const isCurrent = () => !disposed && attempts.get(key) === attempt;
    while (isCurrent()) {
      const { row, webview } = attempt;
      const current = await findCurrentSource(attempt);
      if (!current) return;
      if (!isCurrent()) return;
      const expected = expectedWebviewBuildSource(current);
      const outcome = await reportResult(row.id, webview.id, result, expected);
      // A conditional-write conflict reuses the finished result; it never runs the build again.
      if (outcome === "source-changed") continue;
      await recordBuildOutcome(backoff, key, attempt, result, outcome, isCurrent);
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
    const inspected = await inspectWebviewBuild(
      row,
      snapshot.loaded.metadata.name,
      webview,
      snapshot.loaded.preparedRevision?.packagePath,
    );
    const { signature } = inspected;
    const paths = resolveManagedWebviewPaths({ installedExtensionId: row.id, webviewCacheRoot, webviewId: webview.id });
    let attempt = attempts.get(key);
    if (attempt?.signature === signature) {
      // A watcher refresh does not wait for an unchanged sibling. A source adoption must
      // reconcile its own state, including when Reload adopts the same hash again.
      if (!validatedSource && attempt.work instanceof Promise && attempt.row.source_hash === row.source_hash) return;
    } else {
      if (attempt) attempts.delete(key);
      if (readWebviewBuildSignature(paths.distDir) === signature || backoff.isBlocked(key, signature)) return;
      backoff.forget(key);
      const created: BuildAttempt = {
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

  const refreshManagedWebviews = async ({ current, validatedSource, handled }: SourceRefresh) => {
    const { row, snapshot } = current;
    const webviews = collectExtensionWebviews(snapshot.loaded).filter(
      (view) => classifyWebviewEntry(view.entry).kind === "managed",
    );
    if (validatedSource) retireRemovedAttempts(attempts, row.id, webviews);
    if (handled && (await hasAcceptedWebviews(row, webviewCacheRoot))) {
      await notifyAcceptedWebviewPublication(input.reportPublication, current, webviewCacheRoot, () =>
        loadCurrentSource(row.id, snapshot),
      );
      return webviews.map((view) => view.id);
    }
    if (disposed) return null;
    const results = await Promise.allSettled(
      webviews.map((view) => buildManagedWebview(row, snapshot, view, validatedSource)),
    );
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
    }
    return webviews.map((view) => view.id);
  };

  const refreshRow = async (installedExtensionId: string, validatedSource?: LoadedExtensionSnapshot) => {
    if (disposed) return null;
    if (
      canRetainNativeWebviews(input, validatedSource) &&
      (await hasAcceptedNativeWebviews(await getInstalledSource(installedExtensionId)))
    )
      return [];
    let current = await loadCurrentSource(installedExtensionId, validatedSource);
    if (!current || disposed) return null;
    let handled = false;
    if (!input.buildWebview) {
      const completed = await completeInitialWebviews({
        current,
        loadCurrent: () => loadCurrentSource(installedExtensionId, current!.snapshot),
        reportResult,
        retirePriorAttempts: () => retireRemovedAttempts(attempts, installedExtensionId, []),
      });
      if (!completed.current || disposed) return null;
      current = completed.current;
      handled = completed.handled;
    }
    return refreshManagedWebviews({ current, validatedSource, handled });
  };

  const check = (installedExtensionId: string, validatedSource?: LoadedExtensionSnapshot) =>
    pending.check(installedExtensionId, () => refreshRow(installedExtensionId, validatedSource));

  const ensure = async (installedExtensionId: string, webviewId?: string) => {
    if (await hasAcceptedWebviews(await getInstalledSource(installedExtensionId), webviewCacheRoot, webviewId)) return;
    if (disposed) return Promise.resolve();
    const running = pending.join(installedExtensionId);
    if (running) return running;
    const repair =
      webviewId !== undefined &&
      checked.get(installedExtensionId)?.has(webviewId) === true &&
      !backoff.hasFailure(processKey(installedExtensionId, webviewId)) &&
      !isWebviewPublished(webviewCacheRoot, installedExtensionId, webviewId);
    if (checked.has(installedExtensionId) && !repair) return Promise.resolve();
    checked.delete(installedExtensionId);
    check(installedExtensionId);
    return pending.join(installedExtensionId)!;
  };

  const refreshSources = async (sourcePath?: string, validatedSource?: LoadedExtensionSnapshot) => {
    if (disposed) return;
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
          checked.delete(row.id);
          if (sourcePath) backoff.forgetExtension(row.id);
          else backoff.forget(row.id);
          return check(row.id, validatedSource);
        }),
    );
  };

  const refresh = async (sourcePath?: string) => {
    try {
      await withBackgroundPreparation(() => refreshSources(sourcePath));
    } catch (error) {
      input.onError?.(error);
    }
  };

  const adopt = async (sourcePath: string, validatedSource?: LoadedExtensionSnapshot) => {
    if (disposed) return;
    const row = (await input.listInstalledSources()).find((row) => row.source_path === sourcePath);
    if (!row) return;
    backoff.forgetExtension(row.id);
    if (!input.buildWebview && (await hasAcceptedWebviews(row, webviewCacheRoot))) return;
    const current = await loadCurrentSource(row.id, validatedSource);
    if (!current || disposed) return;
    await refreshSources(current.row.source_path, current.snapshot);
  };

  // Watch attachments and source events own freshness. Registration changes only
  // repair missing output, avoiding a second scan of every already watched source.
  const reconcile = () =>
    withBackgroundPreparation(async () => {
      if (disposed) return;
      await reconcileAcceptedWebviews(await input.listInstalledSources(), webviewCacheRoot, check);
    });

  const dispose = () => {
    disposed = true;
    for (const controller of activeBuilds) controller.abort();
    activeBuilds.clear();
    attempts.clear();
    checked.clear();
    pending.clear();
    backoff.clear();
  };
  return { adopt, dispose, ensure, reconcile, refresh };
};
