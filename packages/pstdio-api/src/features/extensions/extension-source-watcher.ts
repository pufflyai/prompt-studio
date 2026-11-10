import { subscribePreparationEvents, withBackgroundPreparation } from "pstdio-extensions";
import {
  type CreateExtensionSourceWatcherInput,
  createExtensionSourceWatcher as createLocalWatcher,
} from "pstdio-extensions/authoring";
import { runExtensionPreparation } from "./extension-preparation";

export type { CreateExtensionSourceWatcherInput, ExtensionSourceWatcher } from "pstdio-extensions/authoring";

export const createExtensionSourceWatcher = async (input: CreateExtensionSourceWatcherInput) => {
  if (input.watch || input.includeIgnoredPath) return createLocalWatcher(input);
  const id = crypto.randomUUID();
  let disposed = false;
  let registered = false;
  const running = new Map<string, Promise<void>>();
  const queued = new Set<string>();
  const changed = (path: string) => {
    if (disposed) return;
    if (running.has(path)) {
      queued.add(path);
      return;
    }
    const work = withBackgroundPreparation(() => input.onSourceChanged(path))
      .catch((error) => input.onError?.(error))
      .then(() => undefined)
      .finally(() => {
        running.delete(path);
        if (queued.delete(path)) changed(path);
      });
    running.set(path, work);
  };
  const unsubscribe = subscribePreparationEvents((event) => {
    if (!disposed && registered && (event.kind === "worker-ready" || event.kind === "worker-lost")) {
      void refresh().catch((error) => input.onError?.(error));
      return;
    }
    if (disposed || event.watchId !== id) return;
    if (typeof event.error === "string") input.onError?.(new Error(event.error));
    else if (typeof event.sourcePath === "string") changed(event.sourcePath);
  });
  const refresh = async (sourcePath?: string) => {
    if (disposed) return;
    const rows = await input.listInstalledSources();
    if (disposed) return;
    await runExtensionPreparation(
      "watch.update",
      { id, kind: "sources", rows, sourcePath },
      { priority: "background" },
    );
  };
  try {
    await refresh();
    registered = true;
  } catch (error) {
    unsubscribe();
    throw error;
  }
  return {
    refresh,
    dispose: async () => {
      disposed = true;
      queued.clear();
      unsubscribe();
      await Promise.allSettled([...running.values()]);
      await runExtensionPreparation("watch.dispose", { id }).catch(() => {});
    },
  };
};
