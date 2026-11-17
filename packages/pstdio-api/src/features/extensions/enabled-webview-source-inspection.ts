import type { LoadedExtension } from "./extension-runtime";
import { inspectWebviewSource } from "./extension-webview-source-inspection";

// Watch registration is metadata. Only an enabled project owns executable source
// inspection, including when ownership disappears while preparation is queued.
export const createEnabledWebviewSourceInspection = (isEligible: (path: string) => Promise<boolean>) => {
  type Owner = { path: string; controller: AbortController; work: Promise<LoadedExtension | null> };
  const active = new Set<Owner>();
  let disposed = false;
  return {
    inspect: (path: string) => {
      const controller = new AbortController();
      let owner: Owner;
      const work = Promise.resolve()
        .then(async () => {
          if (disposed || !(await isEligible(path))) return null;
          controller.signal.throwIfAborted();
          return inspectWebviewSource(path, controller.signal);
        })
        .catch((error) => {
          if (controller.signal.aborted) return null;
          throw error;
        })
        .finally(() => active.delete(owner));
      owner = { path, controller, work };
      active.add(owner);
      return work;
    },
    reconcile: async () => {
      await Promise.all(
        [...active].map(async (owner) => {
          if (await isEligible(owner.path)) return;
          owner.controller.abort(new Error("Webview source no longer has an enabled project."));
          await owner.work;
        }),
      );
    },
    dispose: async () => {
      disposed = true;
      for (const owner of active) owner.controller.abort(new Error("Webview source inspection stopped."));
      await Promise.allSettled([...active].map((owner) => owner.work));
    },
  };
};
