import { dirname } from "node:path";
import { withBackgroundPreparation } from "pstdio-extensions";
import { runExtensionPreparation } from "./extension-preparation";

// Candidate inspection is speculation, independent of the per-source frontend
// generation. A later edit can cancel a suspended evaluation before refreshing.
export const createRuntimeCandidateInspection = (input: {
  acceptedHash: (path: string) => Promise<string | null | undefined>;
  onError: (error: unknown) => void;
}) => {
  const completed = new Map<string, string>();
  const active = new Map<string, { hash: string; controller: AbortController; work: Promise<void> }>();
  const running = new Set<Promise<void>>();
  let disposed = false;
  const cancel = (path: string) => {
    active.get(path)?.controller.abort(new Error("Runtime candidate superseded."));
    active.delete(path);
  };
  return {
    cancel,
    inspect: (path: string, hash: string) => {
      if (disposed) return Promise.resolve();
      const previous = active.get(path);
      if (previous?.hash === hash) return previous.work;
      cancel(path);
      const controller = new AbortController();
      const current = { hash, controller, work: Promise.resolve() };
      active.set(path, current);
      const work = withBackgroundPreparation(async () => {
        if (hash === (await input.acceptedHash(path)) || completed.get(path) === hash) return;
        controller.signal.throwIfAborted();
        await runExtensionPreparation(
          "source.check",
          { sourcePath: path, extensionsRoot: dirname(path) },
          { signal: controller.signal },
        );
        controller.signal.throwIfAborted();
        completed.set(path, hash);
      })
        .catch((error) => {
          if (!controller.signal.aborted) input.onError(error);
        })
        .finally(() => {
          if (active.get(path) === current) active.delete(path);
          running.delete(work);
        });
      current.work = work;
      running.add(work);
      return work;
    },
    dispose: async () => {
      disposed = true;
      for (const { controller } of active.values())
        controller.abort(new Error("Runtime candidate inspection stopped."));
      await Promise.allSettled(running);
      active.clear();
      completed.clear();
    },
  };
};
