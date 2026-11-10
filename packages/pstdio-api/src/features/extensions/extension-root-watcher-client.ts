import { subscribePreparationEvents, withBackgroundPreparation } from "pstdio-extensions";
import { withPreparationContinuation } from "pstdio-extensions/preparation-client";
import { runExtensionPreparation } from "./extension-preparation";
import type { CreateExtensionRootWatcherInput } from "./extension-root-watcher";
import { createPreparationWatchRefresh } from "./preparation-watch-refresh";

export const createRootWatcherClient = async (input: CreateExtensionRootWatcherInput) => {
  const id = crypto.randomUUID();
  let disposed = false;
  let registered = false;
  let roots: Awaited<ReturnType<CreateExtensionRootWatcherInput["listExtensionRoots"]>> = [];
  const running = new Map<string, Promise<void>>();
  const queued = new Set<string>();
  const sync = (path: string) => {
    if (disposed) return;
    if (running.has(path)) {
      queued.add(path);
      return;
    }
    const work = Promise.resolve()
      .then(() => withBackgroundPreparation(() => roots.find((root) => root.path === path)?.sync()))
      .catch((error) => input.onError?.(error))
      .then(() => undefined)
      .finally(() => {
        running.delete(path);
        if (queued.delete(path)) sync(path);
      });
    running.set(path, work);
  };
  const unsubscribe = subscribePreparationEvents((event) => {
    if (!disposed && registered && (event.kind === "worker-ready" || event.kind === "worker-lost")) {
      void withPreparationContinuation(refresh, { priority: "restoration" }).catch((error) => input.onError?.(error));
      return;
    }
    if (disposed || event.watchId !== id) return;
    if (typeof event.error === "string") input.onError?.(new Error(event.error));
    else if (typeof event.sourcePath === "string") void sync(event.sourcePath);
  });
  const refreshOwner = createPreparationWatchRefresh(async (_sourcePath, signal) => {
    if (disposed) return;
    roots = await input.listExtensionRoots();
    if (disposed) return;
    await runExtensionPreparation(
      "watch.update",
      { id, kind: "roots", rows: roots.map(({ path }) => ({ path })) },
      { priority: "background", signal },
    );
  });
  const refresh = refreshOwner.refresh;
  try {
    await refresh();
    registered = true;
  } catch (error) {
    disposed = true;
    unsubscribe();
    await refreshOwner.dispose();
    throw error;
  }
  return {
    refresh,
    dispose: async () => {
      disposed = true;
      queued.clear();
      unsubscribe();
      await refreshOwner.dispose();
      await Promise.allSettled([...running.values()]);
      await runExtensionPreparation("watch.dispose", { id }).catch(() => {});
    },
  };
};
