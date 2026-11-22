import { fileURLToPath } from "node:url";
import { isPackagedRuntime } from "pstdio-paths";
import {
  BackendUnavailableError,
  type BackendWorker,
  type BackendWorkerOptions,
  startBackendWorker,
} from "./supervisor";

/** The packaged CLI selects its private worker entry before it loads the API or opens the database. */
export const backendWorkerCommand = () =>
  isPackagedRuntime()
    ? [process.execPath, "extension-backend-worker"]
    : [process.execPath, "--no-env-file", fileURLToPath(new URL("./backend-worker.entry.ts", import.meta.url))];

/**
 * One lazily started worker per source generation, shared by every project that enables it. A
 * worker that can no longer answer is forgotten, and only the next request starts another: no restart loop.
 */
export const createBackendWorkerPool = (start: (key: string) => Omit<BackendWorkerOptions, "command">) => {
  const workers = new Map<string, Promise<BackendWorker>>();
  const stopping = new Set<Promise<void>>();
  let closing: Promise<void> | undefined;

  const acquire = (key: string) => {
    if (closing) return Promise.reject(new BackendUnavailableError("Extension backends are shutting down."));
    const existing = workers.get(key);
    if (existing) return existing;
    const starting = startBackendWorker({ command: backendWorkerCommand(), ...start(key) });
    workers.set(key, starting);
    const forget = () => {
      if (workers.get(key) === starting) workers.delete(key);
    };
    starting.then((worker) => worker.closed.then(forget), forget);
    return starting;
  };

  /** Resolves once the worker has stopped. Await it before acquiring a changed generation's key. */
  const retire = (key: string) => {
    const worker = workers.get(key);
    if (!worker) return Promise.resolve();
    workers.delete(key);
    const stopped = worker.then(
      (running) => running.stop(),
      () => {},
    );
    const completion = stopped.finally(() => stopping.delete(completion));
    stopping.add(completion);
    return completion;
  };

  /** Refuses new workers while it stops the running ones; the pool can be used again afterwards. */
  const close = () => {
    closing ??= Promise.resolve()
      .then(async () => {
        for (const key of workers.keys()) void retire(key);
        const results = await Promise.allSettled(stopping);
        const failure = results.find((result) => result.status === "rejected");
        if (failure) throw failure.reason;
      })
      .finally(() => {
        closing = undefined;
      });
    return closing;
  };

  return { acquire, retire, close };
};
