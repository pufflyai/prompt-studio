import { createPreparationScope } from "pstdio-extensions";
import { type CheckOwner, joinPreparationDependencies } from "./pending-webview-checks";

type Refresh = CheckOwner & {
  sourcePath?: string;
  completion: ReturnType<typeof Promise.withResolvers<void>>;
};

// A watcher owns one active snapshot and one latest pending intent. Callers lend
// their continuation to both generations while awaiting their own registration.
export const createPreparationWatchRefresh = (
  update: (sourcePath: string | undefined, signal: AbortSignal) => Promise<void>,
) => {
  const controller = new AbortController();
  let active: Refresh | undefined;
  let pending: Refresh | undefined;
  const finish = (refresh: Refresh, error?: unknown) => {
    refresh.settled = true;
    refresh.scope.dispose();
    if (error) refresh.completion.reject(error);
    else refresh.completion.resolve();
  };
  const pump = () => {
    if (active || !pending || controller.signal.aborted) return;
    const current = pending;
    pending = undefined;
    active = current;
    void current.scope
      .run(async () => {
        controller.signal.throwIfAborted();
        await update(current.sourcePath, controller.signal);
      })
      .then(
        () => finish(current),
        (error) => finish(current, error),
      )
      .finally(() => {
        active = undefined;
        queueMicrotask(pump);
      });
  };
  return {
    refresh: (sourcePath?: string) => {
      if (controller.signal.aborted) return Promise.resolve();
      const caller = createPreparationScope();
      if (pending) {
        if (pending.sourcePath !== sourcePath) pending.sourcePath = undefined;
      } else {
        pending = {
          sourcePath,
          scope: createPreparationScope(),
          settled: false,
          completion: Promise.withResolvers<void>(),
        };
      }
      const generation = pending;
      const owners = active ? [active, generation] : [generation];
      const joined = joinPreparationDependencies(caller, owners, generation.completion.promise);
      queueMicrotask(pump);
      return joined.finally(() => caller.dispose());
    },
    dispose: async () => {
      controller.abort(new Error("Extension watch registration stopped."));
      if (pending) finish(pending);
      pending = undefined;
      await active?.completion.promise.catch(() => {});
    },
  };
};
