import { isMainThread, Worker } from "node:worker_threads";
import { isPackagedRuntime, resolvePstdioHome } from "pstdio-paths";
import { PreparationUnavailableError } from "./preparation-error";
import { createPreparationWorkerSlots, type PreparationWorkerSlot } from "./preparation-worker-slot";

import { extensionUpgradeConcurrency } from "./upgrade-concurrency";

export { PreparationUnavailableError } from "./preparation-error";
export { extensionUpgradeConcurrency };

import {
  activePreparationPriority,
  cancelQueuedPreparation,
  createJob,
  type Job,
  orderPreparationQueue,
  type PreparationOptions,
  preparationJobMessage,
  preparationQueuePriority,
  refreshYieldHolds,
  settlePreparationJob,
  waitForPreparation,
} from "./preparation-queue";

export { createPreparationScope, withBackgroundPreparation, withRequestedPreparation } from "./preparation-priority";
export type { PreparationOptions } from "./preparation-queue";
export { isMainThread as isPreparationHost };

import {
  createPoolYieldClock,
  hasIdlePreparationSlot,
  preemptPreparationBuildBlockers,
  preparationPreemptionTarget,
  preparationSlotCompatible,
} from "./preparation-preemption";
import { createPreparationContinuations, preparationPriority, withContinuingPreparation } from "./preparation-priority";

export interface PreparationEvent {
  kind?: string;
  [key: string]: unknown;
}

// One queue preserves priorities and coalescing across the fixed worker slots.
// Child leaves share a host-owned cap and report dependency waits to this scheduler.
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
const createIdleRetirements = () => {
  const timers = new Map<PreparationWorkerSlot, ReturnType<typeof setTimeout>>();
  return {
    onIdle(slot: PreparationWorkerSlot, retire: () => void) {
      slot.worker?.unref();
      // Slot zero owns stateful watches. Release only an idle overflow slot.
      if (!slot.index || !slot.worker || !slot.ready || slot.active || timers.has(slot)) return;
      const timer = setTimeout(() => {
        timers.delete(slot);
        retire();
      }, 5_000);
      timer.unref();
      timers.set(slot, timer);
    },
    cancel(slot: PreparationWorkerSlot) {
      clearTimeout(timers.get(slot));
      timers.delete(slot);
    },
    clear() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
};

export const createPreparationClient = (
  createWorker: () => Worker,
  cleanup?: (homes: PreparationHome[]) => Promise<void>,
  options: { workers?: 1 | 2 | 3 | 4 } = {},
) => {
  let nextId = 0;
  let backgroundPump: ReturnType<typeof setTimeout> | undefined;
  const idleRetirements = createIdleRetirements();
  let stopping: Promise<void> | undefined;
  const homes = new Map<string, PreparationHome>();
  const queued: Job[] = [];
  const jobs = new Map<string, Job>();
  const listeners = new Set<(event: PreparationEvent) => void>();
  const continuations = createPreparationContinuations(() => schedule());
  const queuedPriority = preparationQueuePriority(continuations);
  const settle = (job: Job, error: unknown, value?: unknown) => settlePreparationJob(jobs, job, error, value);
  const pool = createPreparationWorkerSlots(options.workers ?? 1, {
    factory: () => createWorker,
    pump: () => schedule(),
    event: (slot, event) => {
      // Stateful watches live on the exclusive slot. Peer replacement must not
      // restore those watches or publish duplicate lifecycle notifications.
      if (slot.index && (event.kind === "worker-ready" || event.kind === "worker-lost")) return;
      for (const listener of listeners) listener(event);
    },
    failed: (slot, error) => {
      if (slot.active) settle(slot.active, error);
      // A pool failure belongs to that worker. Its peer and unassigned requests
      // retain their ownership; a failed factory cannot leave callers stranded.
      if (pool.slots.length === 1) for (const job of queued.splice(0)) settle(job, error);
    },
    completed: settle,
  });
  const waits = {
    idle: (job: Job) => hasIdlePreparationSlot(pool, job),
    priority: queuedPriority,
    eligible: (job: Job) => orderPreparationQueue([job], queuedPriority, continuations),
  };
  const { clock, yieldTo } = createPoolYieldClock(
    pool,
    () => candidates(),
    waits,
    () => schedule(),
  );
  const candidates = () => [
    ...queued,
    ...pool.slots.flatMap((slot) => (!slot.dispatched && slot.active ? [slot.active] : [])),
  ];
  const nextFor = (slot: PreparationWorkerSlot) => {
    const pending = candidates();
    if (!orderPreparationQueue(pending, queuedPriority, continuations, clock)) return;
    // An exclusive job is a barrier: later installs cannot starve a watcher,
    // global scan or adoption by continually filling the other slot.
    const barrier = pending.findIndex((job) => !job.resources);
    const available = barrier < 0 ? pending : pending.slice(0, barrier + 1);
    return available.find((job) => {
      if (!orderPreparationQueue([job], queuedPriority, continuations, clock)) return false;
      const owner = pool.slots.find((other) => other.active === job);
      return (!owner || owner === slot) && preparationSlotCompatible(pool, job, slot);
    });
  };
  const reserve = (slot: PreparationWorkerSlot, job: Job) => {
    const index = queued.indexOf(job);
    if (index >= 0) queued.splice(index, 1);
    if (slot.active && slot.active !== job) queued.push(slot.active);
    slot.active = job;
  };
  const startSlot = (slot: PreparationWorkerSlot, job: Job) => {
    if (slot.worker) return;
    // A lazy factory failure belongs to its selected owner, not its peer's queue.
    reserve(slot, job);
    pool.start(slot);
    if (slot.worker) return;
    slot.active = undefined;
    if (queued.length) queueMicrotask(() => schedule());
  };
  const pumpSlot = (slot: PreparationWorkerSlot, backgroundReady: boolean) => {
    if (slot.dispatched || slot.restarting) return;
    if (slot.worker && slot.factory !== createWorker) return pool.replace(slot, slot.active);
    const job = nextFor(slot);
    if (!job)
      return idleRetirements.onIdle(slot, () => {
        if (!stopping && !slot.active && !queued.length && !continuations.size) pool.replace(slot);
      });
    idleRetirements.cancel(slot);
    if (queuedPriority(job) > 0 && !backgroundReady) {
      backgroundPump ??= setTimeout(() => {
        backgroundPump = undefined;
        schedule(true);
      }, 0);
      slot.worker?.unref();
      return;
    }
    startSlot(slot, job);
    if (!slot.worker || !slot.ready) return;
    // Select before returning an interrupted owner to the waiting array.
    reserve(slot, job);
    slot.dispatched = true;
    slot.worker.ref();
    slot.worker.postMessage(preparationJobMessage(job));
  };
  const pump = (backgroundReady = false) => {
    if (!stopping) for (const slot of pool.slots) pumpSlot(slot, backgroundReady);
  };
  const preemptBuildBlockers = () => preemptPreparationBuildBlockers(pool, queuedPriority);
  const schedule = (backgroundReady = false) => {
    refreshYieldHolds(candidates(), clock);
    if (!stopping) preemptBuildBlockers();
    pump(backgroundReady);
    // A step dispatched by this pump makes its owner busy, even if the search below stops before its held job.
    refreshYieldHolds(candidates(), clock);
    if (stopping) return;
    const pending = candidates();
    if (!orderPreparationQueue(pending, queuedPriority, continuations, clock) || !pending[0]) return;
    const target = preparationPreemptionTarget(pool, pending, {
      ...waits,
      eligible: (job) => orderPreparationQueue([job], queuedPriority, continuations, clock),
    });
    if (!target) return;
    for (const slot of target.slots)
      if (
        slot.dispatched &&
        slot.active &&
        queuedPriority(target.job) < activePreparationPriority(slot.active, queuedPriority)
      )
        yieldTo(slot, target.job);
  };
  return {
    withContinuation: continuePreparation(continuations),
    configureWorker: (factory: () => Worker) => {
      createWorker = factory;
      schedule();
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
      const resources = options.resources && [...new Set(options.resources)].sort();
      const key = `${home}\0${task}\0${options.key ?? JSON.stringify(input)}\0${JSON.stringify(resources)}`;
      const scope = preparationPriority.getStore();
      let job = jobs.get(key);
      if (!job) {
        if (queued.length >= 128)
          return Promise.reject(new PreparationUnavailableError("Extension preparation queue is full."));
        job = createJob(++nextId, key, task, input, home, resources);
        jobs.set(key, job);
        queued.push(job);
      }
      const owned = job;
      continuations.retain(scope);
      const request = () => {
        if (!stopping && jobs.get(owned.key) === owned) schedule();
      };
      const result = waitForPreparation(owned, options, scope, request, () => {
        cancelQueuedPreparation(jobs, queued, owned);
        const slot = pool.slots.find((slot) => slot.active === owned || slot.retiring === owned);
        if (slot?.active === owned) {
          if (slot.dispatched && slot.worker) pool.replace(slot);
          else slot.active = undefined;
        }
        schedule();
        // A closed caller must not outlive its worker, including an evaluation
        // already retiring after preemption. Unrelated slot work stays admitted.
        return slot?.retiring === owned ? slot.restarting : undefined;
      });
      schedule();
      return result as Promise<T>;
    },
    stop: (finalCleanup = true) => {
      if (stopping) return stopping;
      continuations.clear();
      idleRetirements.clear();
      if (backgroundPump) clearTimeout(backgroundPump);
      backgroundPump = undefined;
      const error = new PreparationUnavailableError("Extension preparation stopped.");
      for (const job of jobs.values()) settle(job, error);
      queued.length = 0;
      // Publish stopping before retirement callbacks can admit more work.
      const finished = Promise.withResolvers<void>();
      stopping = finished.promise;
      void (async () => {
        await pool.stop();
        if (finalCleanup) {
          await cleanup?.([...homes.values()]);
          homes.clear();
        }
      })()
        .then(finished.resolve, finished.reject)
        .finally(() => {
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
const shared = createPreparationClient(defaultWorker, (homes) => cleanup?.(homes) ?? Promise.resolve(), {
  workers: extensionUpgradeConcurrency,
});
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
