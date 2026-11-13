import { AsyncLocalStorage } from "node:async_hooks";
import { createPreparationScope } from "pstdio-extensions";

const activeDefaultInstall = new AsyncLocalStorage<ReturnType<typeof createPreparationScope>>();
const waiting = new Set<ReturnType<typeof createPreparationScope>>();
let defaultExtensionInstallQueue: Promise<void> = Promise.resolve();

export const enqueueDefaultExtensionInstall = <T>(install: () => Promise<T>, signal?: AbortSignal) => {
  const scope = createPreparationScope();
  if (signal?.aborted) {
    scope.dispose();
    return Promise.reject(signal.reason);
  }
  const active = activeDefaultInstall.getStore();
  if (active && waiting.has(active)) {
    // Nested work already inherits the active context; taking a lease on itself
    // would keep borrowed urgency alive after the original foreground waiter leaves.
    scope.dispose();
    return install();
  }
  const dependencies = [...waiting];
  const releases = new Map<ReturnType<typeof createPreparationScope>, () => void>();
  const refreshDependencies = () => {
    for (const dependency of dependencies) {
      if (scope.requested && waiting.has(dependency) && !releases.has(dependency))
        releases.set(dependency, dependency.request());
      else if (!scope.requested && releases.has(dependency)) {
        releases.get(dependency)!();
        releases.delete(dependency);
      }
    }
  };
  const unsubscribe = scope.subscribe(refreshDependencies);
  refreshDependencies();
  const releaseDependencies = () => {
    unsubscribe();
    for (const release of releases.values()) release();
    releases.clear();
  };
  waiting.add(scope);
  const queued = defaultExtensionInstallQueue
    .then(() => {
      signal?.throwIfAborted();
      return scope.run(() => activeDefaultInstall.run(scope, install));
    })
    .finally(() => {
      waiting.delete(scope);
      scope.dispose();
      releaseDependencies();
    });
  defaultExtensionInstallQueue = queued.then(
    () => undefined,
    () => undefined,
  );
  if (!signal) return queued;

  const abort = Promise.withResolvers<never>();
  const onAbort = () => {
    releaseDependencies();
    abort.reject(signal.reason);
  };
  if (signal.aborted) {
    onAbort();
  } else {
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return Promise.race([queued, abort.promise]).finally(() => signal.removeEventListener("abort", onAbort));
};
