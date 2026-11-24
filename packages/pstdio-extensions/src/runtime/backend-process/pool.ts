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

// A worker that keeps crashing, hanging or failing to start gets a cooldown instead of a restart loop.
const RESTART_BUDGET = { failures: 3, windowMs: 60_000, cooldownMs: 30_000 };

interface WorkerEntry {
  starting: Promise<BackendWorker>;
  lastUsed: number;
  worker?: BackendWorker;
}

export const createBackendWorkerPool = (
  start: (key: string) => Omit<BackendWorkerOptions, "command">,
  { idleMs = IDLE_MS, restartBudget = RESTART_BUDGET } = {},
) => {
  const workers = new Map<string, WorkerEntry>();
  const failures = new Map<string, number[]>();
  const stopping = new Set<Promise<void>>();
  let closing: Promise<void> | undefined;
  let sweep: ReturnType<typeof setInterval> | undefined;

  const recordFailure = (key: string) => {
    const now = performance.now();
    const recent = (failures.get(key) ?? []).filter((at) => now - at < restartBudget.windowMs);
    failures.set(key, [...recent, now]);
  };

  const coolingDown = (key: string) => {
    const recent = failures.get(key) ?? [];
    if (recent.length < restartBudget.failures) return 0;
    const wait = restartBudget.cooldownMs - (performance.now() - recent.at(-1)!);
    if (wait > 0) return wait;
    failures.delete(key);
    return 0;
  };

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
    const wait = coolingDown(key);
    if (wait > 0)
      return Promise.reject(
        new BackendUnavailableError(
          `The extension backend stopped unexpectedly ${restartBudget.failures} times; it can start again in ${Math.ceil(wait / 1000)} s.`,
        ),
      );
    const starting = startBackendWorker({ command: backendWorkerCommand(), ...start(key) });
    const entry: WorkerEntry = { starting, lastUsed: now };
    workers.set(key, entry);
    const forget = () => {
      if (workers.get(key) !== entry) return;
      workers.delete(key);
      recordFailure(key);
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
