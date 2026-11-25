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
// A disabled or removed extension stops being called, so idle retirement also releases its worker.
const IDLE_MS = 10 * 60_000;

interface WorkerEntry {
  starting: Promise<BackendWorker>;
  lastUsed: number;
  worker?: BackendWorker;
}

export const createBackendWorkerPool = (
  start: (key: string) => Omit<BackendWorkerOptions, "command">,
  { idleMs = IDLE_MS } = {},
) => {
  const workers = new Map<string, WorkerEntry>();
  const stopping = new Set<Promise<void>>();
  let closing: Promise<void> | undefined;
  let sweep: ReturnType<typeof setInterval> | undefined;

  const retireIdle = () => {
    const now = performance.now();
    for (const [key, { worker, lastUsed }] of workers) {
      if (worker && !worker.busy && now - Math.max(lastUsed, worker.idleSince) >= idleMs)
        void retire(key).catch(() => {});
    }
  };

  const acquire = (key: string) => {
    if (closing) return Promise.reject(new BackendUnavailableError("Extension backends are shutting down."));
    const now = performance.now();
    const existing = workers.get(key);
    if (existing) {
      existing.lastUsed = now;
      return existing.starting;
    }
    const starting = startBackendWorker({ command: backendWorkerCommand(), ...start(key) });
    const entry: WorkerEntry = { starting, lastUsed: now };
    workers.set(key, entry);
    const forget = () => {
      if (workers.get(key) === entry) workers.delete(key);
    };
    void starting.then((worker) => {
      entry.worker = worker;
      return worker.closed.then(forget);
    }, forget);
    if (!sweep) {
      sweep = setInterval(retireIdle, Math.max(1, Math.min(idleMs, 60_000)));
      sweep.unref?.();
    }
    return starting;
  };

  /** Resolves once the worker has stopped. Await it before acquiring a changed generation's key. */
  const retire = (key: string) => {
    const entry = workers.get(key);
    if (!entry) return Promise.resolve();
    workers.delete(key);
    const stopped = entry.starting.then(
      (running) => running.stop(),
      () => {},
    );
    const completion = stopped.finally(() => stopping.delete(completion));
    stopping.add(completion);
    return completion;
  };

  /** Refuses new workers while it stops the running ones; the pool can be used again afterwards. */
  const close = () => {
    if (!closing) {
      clearInterval(sweep);
      sweep = undefined;
    }
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
