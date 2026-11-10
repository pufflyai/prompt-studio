import { isMainThread, Worker } from "node:worker_threads";
import { isPackagedRuntime, registerFileMutationWorker, resolvePstdioHome } from "pstdio-paths";

import { ownPreparationCommands } from "./preparation-command";

export { createPreparationScope, withBackgroundPreparation, withRequestedPreparation } from "./preparation-priority";
export { isMainThread as isPreparationHost };

import { preparationPriority } from "./preparation-priority";
export interface PreparationOptions {
  signal?: AbortSignal;
  priority?: "requested" | "background";
  key?: string;
  home?: string;
}
const priorityFor = (options: PreparationOptions, scope: ReturnType<typeof preparationPriority.getStore>) =>
  (options.priority ?? scope?.priority) === "background" ? 1 : 0;
interface Waiter {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  removeAbort: () => void;
  priority: () => number;
}
interface Job {
  id: number;
  key: string;
  task: string;
  input: unknown;
  home: string;
  env: NodeJS.ProcessEnv;
  priority: number;
  waiters: Set<Waiter>;
}
const createJob = (id: number, key: string, task: string, input: unknown, home: string) => ({
  id,
  key,
  task,
  input,
  home,
  env: { ...process.env },
  get priority() {
    for (const waiter of this.waiters) if (waiter.priority() === 0) return 0;
    return 1;
  },
  waiters: new Set<Waiter>(),
});
export interface PreparationEvent {
  kind?: string;
  [key: string]: unknown;
}

// One queue also bounds the child processes started by a preparation job. Keeping admission
// here lets a requested tool overtake speculative work before the worker starts the next job.
export interface PreparationHome {
  home: string;
  env: NodeJS.ProcessEnv;
}
export const createPreparationClient = (
  createWorker: () => Worker,
  cleanup?: (homes: PreparationHome[]) => Promise<void>,
) => {
  let worker: Worker | undefined;
  let ready = false;
  let active: Job | undefined;
  let nextId = 0;
  let backgroundPump: ReturnType<typeof setTimeout> | undefined;
  let stopping: Promise<void> | undefined;
  let restarting: Promise<void> | undefined;
  const homes = new Map<string, PreparationHome>();
  const retirements = new WeakMap<Worker, () => Promise<void>>();
  const queued: Job[] = [];
  const jobs = new Map<string, Job>();
  const listeners = new Set<(event: PreparationEvent) => void>();
  const settle = (job: Job, error: unknown, value?: unknown) => {
    if (jobs.get(job.key) === job) jobs.delete(job.key);
    for (const waiter of job.waiters) {
      waiter.removeAbort();
      if (error) waiter.reject(error);
      else waiter.resolve(value);
    }
    job.waiters.clear();
  };
  const fail = (current: Worker, error: unknown, notify = true) => {
    if (worker !== current) return;
    worker = undefined;
    ready = false;
    if (active) settle(active, error);
    active = undefined;
    for (const job of queued.splice(0)) settle(job, error);
    if (notify) {
      restarting = retire(current).finally(() => {
        restarting = undefined;
        if (!stopping && queued.length) {
          start();
          pump();
        }
      });
      for (const listener of listeners) listener({ kind: "worker-lost" });
    }
  };
  const retire = async (current: Worker) => {
    await retirements.get(current)?.();
    await current.terminate();
  };
  const pump = (backgroundReady = false) => {
    if (!worker || !ready || active || stopping) return;
    queued.sort((a, b) => a.priority - b.priority || a.id - b.id);
    // Let foreground continuations enqueue their next step before resuming speculative
    // work; starting it inside the response event otherwise causes repeated retirement.
    if (queued[0]?.priority === 1 && !backgroundReady) {
      backgroundPump ??= setTimeout(() => {
        backgroundPump = undefined;
        pump(true);
      }, 0);
      worker.unref();
      return;
    }
    active = queued.shift();
    if (!active) {
      worker.unref();
      return;
    }
    worker.ref();
    worker.postMessage({
      kind: "run",
      id: active.id,
      task: active.task,
      input: active.input,
      home: active.home,
      env: active.env,
    });
  };
  const onMessage = (
    current: Worker,
    message: {
      kind?: string;
      event: PreparationEvent;
      id?: number;
      error?: { message: string };
      value?: unknown;
    },
  ) => {
    if (worker !== current) return;
    if (message.kind === "event") {
      for (const listener of listeners) listener(message.event);
      return;
    }
    if (message.kind === "ready") {
      ready = true;
      for (const listener of listeners) listener({ kind: "worker-ready" });
      pump();
      return;
    }
    if (!active || message.id !== active.id) return;
    const job = active;
    active = undefined;
    let error: Error | undefined;
    if (message.error) {
      error = Object.assign(new Error(message.error.message), message.error);
    }
    settle(job, error, message.value);
    pump();
  };
  const start = () => {
    if (worker || restarting) return;
    const current = createWorker();
    worker = current;
    const releaseLocks = registerFileMutationWorker(current);
    const stopCommands = ownPreparationCommands(current);
    retirements.set(current, async () => {
      await stopCommands();
    });
    current.once("exit", releaseLocks);
    current.on("message", (message) => onMessage(current, message));
    current.on("error", (error) => fail(current, error));
    current.on("exit", (code) => {
      void stopCommands();
      fail(current, new Error(`Extension preparation worker exited (${code}).`));
    });
  };
  const replaceWorker = (resume?: Job) => {
    const current = worker;
    if (!current) return;
    worker = undefined;
    ready = false;
    active = undefined;
    if (resume) queued.push(resume);
    restarting = retire(current).finally(() => {
      restarting = undefined;
      if (!stopping && queued.length) {
        start();
        pump();
      }
    });
    for (const listener of listeners) listener({ kind: "worker-lost" });
  };
  return {
    subscribe: (listener: (event: PreparationEvent) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    run: <T>(task: string, input: unknown, options: PreparationOptions = {}): Promise<T> => {
      if (!isMainThread) throw new Error("Preparation workers must execute nested preparation directly.");
      if (stopping) return Promise.reject(new Error("Extension preparation is stopping."));
      if (options.signal?.aborted) return Promise.reject(options.signal.reason);
      const home = options.home ?? resolvePstdioHome();
      homes.set(home, { home, env: { ...process.env } });
      const key = `${home}\0${task}\0${options.key ?? JSON.stringify(input)}`;
      let job = jobs.get(key);
      if (!job) {
        if (queued.length >= 128) return Promise.reject(new Error("Extension preparation queue is full."));
        job = createJob(++nextId, key, task, input, home);
        jobs.set(key, job);
        queued.push(job);
      }
      const owned = job;
      const scope = preparationPriority.getStore();
      const request = () => {
        if (stopping || jobs.get(owned.key) !== owned) return;
        if (active && queued.some((job) => job.priority < active!.priority)) replaceWorker(active);
        start();
        pump();
      };
      scope?.jobs.add(request);
      const result = new Promise<unknown>((resolve, reject) => {
        const abort = () => {
          owned.waiters.delete(waiter);
          waiter.removeAbort();
          reject(options.signal!.reason);
          if (owned.waiters.size) {
            request();
            return;
          }
          jobs.delete(owned.key);
          const index = queued.indexOf(owned);
          if (index >= 0) queued.splice(index, 1);
          if (active === owned && worker) {
            // Evaluation can contain an unresolved top-level await. Abort children and retire
            // this worker so the cancelled job cannot hold every later tool request hostage.
            replaceWorker();
          }
        };
        const waiter: Waiter = {
          resolve,
          reject,
          priority: () => priorityFor(options, scope),
          removeAbort: () => options.signal?.removeEventListener("abort", abort),
        };
        owned.waiters.add(waiter);
        options.signal?.addEventListener("abort", abort, { once: true });
      });
      if (active && active !== owned && active.priority > owned.priority) replaceWorker(active);
      start();
      pump();
      return result.finally(() => {
        scope?.jobs.delete(request);
      }) as Promise<T>;
    },
    stop: (finalCleanup = true) => {
      if (stopping) return stopping;
      const current = worker;
      if (backgroundPump) clearTimeout(backgroundPump);
      backgroundPump = undefined;
      const error = new Error("Extension preparation stopped.");
      if (current) fail(current, error, false);
      else for (const job of queued.splice(0)) settle(job, error);
      stopping = (async () => {
        if (current) await retire(current);
        if (restarting) await restarting;
        if (finalCleanup) {
          await cleanup?.([...homes.values()]);
          homes.clear();
        }
      })().finally(() => {
        stopping = undefined;
      });
      return stopping;
    },
  };
};

let factory = () =>
  new Worker(
    new URL(
      isPackagedRuntime()
        ? "./packages/pstdio-extensions/src/runtime/preparation-worker.js"
        : "./preparation-worker.ts",
      import.meta.url,
    ),
  );
let cleanup: ((homes: PreparationHome[]) => Promise<void>) | undefined;
const shared = createPreparationClient(
  () => factory(),
  (homes) => cleanup?.(homes) ?? Promise.resolve(),
);
export const configureExtensionPreparationWorker = (createWorker: () => Worker, dispose?: typeof cleanup) => {
  cleanup = dispose;
  factory = createWorker;
};
export const runExtensionPreparation = shared.run;
export const stopExtensionPreparation = shared.stop;

export const subscribePreparationEvents = shared.subscribe;

let preparationOwners = 0;
export const retainExtensionPreparation = () => {
  preparationOwners++;
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    preparationOwners--;
    if (preparationOwners === 0) await shared.stop(false);
  };
};
export const stopUnownedExtensionPreparation = () => (preparationOwners === 0 ? shared.stop() : Promise.resolve());
