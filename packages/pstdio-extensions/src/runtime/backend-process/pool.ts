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
 * worker that exits is forgotten, and only the next request starts another: no restart loop.
 */
export const createBackendWorkerPool = (start: (key: string) => Omit<BackendWorkerOptions, "command">) => {
  const workers = new Map<string, Promise<BackendWorker>>();
  let closing = false;

  const acquire = (key: string) => {
    if (closing) return Promise.reject(new BackendUnavailableError("Extension backends are shutting down."));
    const existing = workers.get(key);
    if (existing) return existing;
    const starting = startBackendWorker({ command: backendWorkerCommand(), ...start(key) });
    workers.set(key, starting);
    const forget = () => {
      if (workers.get(key) === starting) workers.delete(key);
    };
    starting.then((worker) => worker.exited.then(forget), forget);
    return starting;
  };

  /** Resolves once the worker has stopped. Await it before acquiring a changed generation's key. */
  const retire = async (key: string) => {
    const worker = workers.get(key);
    workers.delete(key);
    await worker?.then(
      (running) => running.stop(),
      () => {},
    );
  };

  /** Refuses new workers while it stops the running ones; the pool can be used again afterwards. */
  const close = async () => {
    closing = true;
    try {
      while (workers.size > 0) await Promise.all([...workers.keys()].map(retire));
    } finally {
      closing = false;
    }
  };

  return { acquire, retire, close };
};
