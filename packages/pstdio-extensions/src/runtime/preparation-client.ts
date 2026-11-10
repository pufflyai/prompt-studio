import { isMainThread, Worker } from "node:worker_threads";
import { isPackagedRuntime, registerFileMutationWorker, resolvePstdioHome } from "pstdio-paths";

import { ownPreparationCommands } from "./preparation-command";
import { PreparationUnavailableError, preparationUnavailable } from "./preparation-error";

export { PreparationUnavailableError } from "./preparation-error";

import {
  activePreparationPriority,
  cancelQueuedPreparation,
  createJob,
  type Job,
  orderPreparationQueue,
  type PreparationOptions,
  preparationJobMessage,
  preparationQueuePriority,
  settlePreparationJob,
  waitForPreparation,
} from "./preparation-queue";

export { createPreparationScope, withBackgroundPreparation, withRequestedPreparation } from "./preparation-priority";
export type { PreparationOptions } from "./preparation-queue";
export { isMainThread as isPreparationHost };

import { createPreparationContinuations, preparationPriority, withContinuingPreparation } from "./preparation-priority";

const preparationReplyError = (error?: { message: string }) =>
  error ? Object.assign(new Error(error.message), error) : undefined;

export interface PreparationEvent {
  kind?: string;
  [key: string]: unknown;
}

interface PreparationMessage {
  kind?: string;
  event: PreparationEvent;
  id?: number;
  error?: { message: string };
  value?: unknown;
}

// One queue also bounds the child processes started by a preparation job. Keeping admission
// here lets a requested tool overtake speculative work before the worker starts the next job.
export interface PreparationHome {
  home: string;
  env: NodeJS.ProcessEnv;
}
const continuePreparation =
  (continuations: ReturnType<typeof createPreparationContinuations>) =>
  <T>(work: () => T, options: { priority?: "requested" | "background" | "restoration" } = {}) =>
    withContinuingPreparation(() => {
      // Reserve before host/database awaits, while no dependent job exists yet.
      continuations.retain(preparationPriority.getStore());
      return work();
    }, options.priority);
export const createPreparationClient = (
  createWorker: () => Worker,
  cleanup?: (homes: PreparationHome[]) => Promise<void>,
) => {
  let worker: Worker | undefined;
  let workerFactory = createWorker;
  let ready = false;
  let active: Job | undefined;
  let dispatched = false;
  let nextId = 0;
  let backgroundPump: ReturnType<typeof setTimeout> | undefined;
  let stopping: Promise<void> | undefined;
  let restarting: Promise<void> | undefined;
  const homes = new Map<string, PreparationHome>();
  const retirements = new WeakMap<Worker, () => Promise<void>>();
  const queued: Job[] = [];
  const jobs = new Map<string, Job>();
  const listeners = new Set<(event: PreparationEvent) => void>();
  const continuations = createPreparationContinuations(() => {
    if (
      dispatched &&
      active &&
      queued.some((job) => queuedPriority(job) < activePreparationPriority(active!, queuedPriority))
    )
      replaceWorker(active);
    pump();
  });
  const queuedPriority = preparationQueuePriority(continuations);
  const settle = (job: Job, error: unknown, value?: unknown) => settlePreparationJob(jobs, job, error, value);
  const settleAll = (error: unknown) => {
    if (active) settle(active, error);
    active = undefined;
    dispatched = false;
    for (const job of queued.splice(0)) settle(job, error);
  };
  const restart = (current: Worker) => {
    restarting = retire(current).finally(() => {
      restarting = undefined;
      if (!stopping && (queued.length || active)) {
        start();
        pump();
      }
    });
    for (const listener of listeners) listener({ kind: "worker-lost" });
  };
  const fail = (current: Worker, error: unknown, notify = true) => {
    if (worker !== current) return;
    error = preparationUnavailable(error);
    worker = undefined;
    ready = false;
    settleAll(error);
    if (notify) restart(current);
  };
  const retire = async (current: Worker) => {
    await retirements.get(current)?.();
    await current.terminate();
  };
  const pump = (backgroundReady = false) => {
    if (!worker || !ready || dispatched || stopping) return;
    if (workerFactory !== createWorker) return replaceWorker(active);
    // An interrupted job keeps the execution slot while its worker retires. Select
    // its replacement before returning it to the bounded pending queue.
    const pending = active ? [...queued, active] : queued;
    if (!orderPreparationQueue(pending, queuedPriority, continuations)) {
      worker.unref();
      return;
    }
    // Let foreground continuations enqueue their next step before resuming speculative
    // work; starting it inside the response event otherwise causes repeated retirement.
    if (pending[0] && queuedPriority(pending[0]) > 0 && !backgroundReady) {
      backgroundPump ??= setTimeout(() => {
        backgroundPump = undefined;
        pump(true);
      }, 0);
      worker.unref();
      return;
    }
    active = pending.shift();
    if (pending !== queued) queued.splice(0, queued.length, ...pending);
    if (!active) {
      worker.unref();
      return;
    }
    dispatched = true;
    worker.ref();
    worker.postMessage(preparationJobMessage(active));
  };
  const onMessage = (current: Worker, message: PreparationMessage) => {
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
    if (!dispatched || !active || message.id !== active.id) return;
    const job = active;
    active = undefined;
    dispatched = false;
    settle(job, preparationReplyError(message.error), message.value);
    pump();
  };
  const start = () => {
    if (worker || restarting) return;
    workerFactory = createWorker;
    let current: Worker;
    try {
      current = workerFactory();
    } catch (error) {
      settleAll(preparationUnavailable(error));
      return;
    }
    worker = current;
    const releaseLocks = registerFileMutationWorker(current);
    const stopCommands = ownPreparationCommands(current);
    retirements.set(current, stopCommands);
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
    active = resume;
    dispatched = false;
    restart(current);
  };
  return {
    withContinuation: continuePreparation(continuations),
    configureWorker: (factory: () => Worker) => {
      // Finish the admitted job before switching hosts; queued requests keep their owners.
      createWorker = factory;
      pump();
    },
    subscribe: (listener: (event: PreparationEvent) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    run: <T>(task: string, input: unknown, options: PreparationOptions = {}): Promise<T> => {
      if (!isMainThread) throw new Error("Preparation workers must execute nested preparation directly.");
      if (stopping) return Promise.reject(new PreparationUnavailableError("Extension preparation is stopping."));
      if (options.signal?.aborted) return Promise.reject(options.signal.reason);
      const home = options.home ?? resolvePstdioHome();
      homes.set(home, { home, env: { ...process.env } });
      const key = `${home}\0${task}\0${options.key ?? JSON.stringify(input)}`;
      const scope = preparationPriority.getStore();
      let job = jobs.get(key);
      if (!job) {
        if (queued.length >= 128)
          return Promise.reject(new PreparationUnavailableError("Extension preparation queue is full."));
        job = createJob(++nextId, key, task, input, home);
        jobs.set(key, job);
        queued.push(job);
      }
      const owned = job;
      continuations.retain(scope);
      const request = () => {
        if (stopping || jobs.get(owned.key) !== owned) return;
        if (
          dispatched &&
          active &&
          queued.some((job) => queuedPriority(job) < activePreparationPriority(active!, queuedPriority))
        )
          replaceWorker(active);
        start();
        pump();
      };
      const result = waitForPreparation(owned, options, scope, request, () => {
        cancelQueuedPreparation(jobs, queued, owned);
        // An unresolved module evaluation must not outlive its last caller.
        if (active === owned) {
          if (dispatched && worker) replaceWorker();
          else {
            active = undefined;
            pump();
          }
        }
      });
      if (
        dispatched &&
        active &&
        active !== owned &&
        activePreparationPriority(active, queuedPriority) > queuedPriority(owned)
      )
        replaceWorker(active);
      start();
      pump();
      return result as Promise<T>;
    },
    stop: (finalCleanup = true) => {
      if (stopping) return stopping;
      const current = worker;
      continuations.clear();
      if (backgroundPump) clearTimeout(backgroundPump);
      backgroundPump = undefined;
      const error = new PreparationUnavailableError("Extension preparation stopped.");
      if (current) fail(current, error, false);
      else settleAll(error);
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

const defaultWorker = () =>
  new Worker(
    new URL(
      isPackagedRuntime()
        ? "./packages/pstdio-extensions/src/runtime/preparation-worker.js"
        : "./preparation-worker.ts",
      import.meta.url,
    ),
  );
let cleanup: ((homes: PreparationHome[]) => Promise<void>) | undefined;
const shared = createPreparationClient(defaultWorker, (homes) => cleanup?.(homes) ?? Promise.resolve());
export const configureExtensionPreparationWorker = (createWorker: () => Worker, dispose?: typeof cleanup) => {
  cleanup = dispose;
  shared.configureWorker(createWorker);
};
export const runExtensionPreparation = shared.run;
export const withPreparationContinuation = shared.withContinuation;
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
