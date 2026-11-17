import { dirname } from "node:path";
import { withBackgroundPreparation } from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";
import type { checkExtensionSource } from "./extension-runtime";

// Candidate inspection is speculation, independent of the per-source frontend
// generation. A later edit can cancel a suspended evaluation before refreshing.
export const createRuntimeCandidateInspection = (input: {
  acceptedId: (path: string) => Promise<string | null | undefined>;
  onError: (error: unknown) => void;
}) => {
  const completed = new Map<string, string>();
  const active = new Map<string, AbortController>();
  const running = new Set<Promise<void>>();
  let disposed = false;
  const cancel = (path: string) => {
    active.get(path)?.abort(new Error("Runtime candidate superseded."));
    active.delete(path);
  };
  return {
    cancel,
    inspect: (path: string) => {
      if (disposed) return Promise.resolve();
      cancel(path);
      const controller = new AbortController();
      active.set(path, controller);
      const work = withBackgroundPreparation(async () => {
        // Every notification gets a fresh full identity, including dependency and
        // host inputs. Own-source hashes cannot coalesce dependency-only edits.
        const key = await runExtensionPreparation<string>(
          "runtime.key",
          { sourcePath: path },
          { signal: controller.signal },
        );
        if (key === (await input.acceptedId(path)) || completed.get(path) === key) return;
        controller.signal.throwIfAborted();
        const checked = await runExtensionPreparation<Awaited<ReturnType<typeof checkExtensionSource>>>(
          "source.check",
          { sourcePath: path, extensionsRoot: dirname(path) },
          { signal: controller.signal },
        );
        controller.signal.throwIfAborted();
        // Preparation can observe a newer edit than the preceding key lookup.
        const checkedId = checked.loaded?.preparedRevision?.id;
        if (checkedId) completed.set(path, checkedId);
      })
        .catch((error) => {
          if (!controller.signal.aborted) input.onError(error);
        })
        .finally(() => {
          if (active.get(path) === controller) active.delete(path);
          running.delete(work);
        });
      running.add(work);
      return work;
    },
    dispose: async () => {
      disposed = true;
      for (const controller of active.values()) controller.abort(new Error("Runtime candidate inspection stopped."));
      await Promise.allSettled(running);
      active.clear();
      completed.clear();
    },
  };
};
