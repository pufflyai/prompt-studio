import { isMainThread, Worker } from "node:worker_threads";
import { isPackagedRuntime, resolvePstdioHome } from "pstdio-paths";
import { PreparationUnavailableError } from "./preparation-error";
import { createPreparationWorkerSlots, type PreparationWorkerSlot } from "./preparation-worker-slot";

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
  preparationResourcesOverlap,
  settlePreparationJob,
  waitForPreparation,
} from "./preparation-queue";

export { createPreparationScope, withBackgroundPreparation, withRequestedPreparation } from "./preparation-priority";
export type { PreparationOptions } from "./preparation-queue";
export { isMainThread as isPreparationHost };

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
export const createPreparationClient = (
  createWorker: () => Worker,
  cleanup?: (homes: PreparationHome[]) => Promise<void>,
  options: { workers?: 1 | 2 } = {},
) => {
  let nextId = 0;
  let backgroundPump: ReturnType<typeof setTimeout> | undefined;
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
  const runningOwner = (slot: PreparationWorkerSlot) =>
    slot.dispatched || (slot.worker && !slot.ready) ? slot.active : slot.retiring;
  const compatible = (job: Job, slot: PreparationWorkerSlot) => {
    const others = pool.slots
      .filter((other) => other !== slot)
      .flatMap((other) => {
        const owner = runningOwner(other);
        return owner ? [owner] : [];
      });
    if (!job.resources) return slot.index === 0 && !others.length;
    return others.every(
      (other) =>
        other.resources &&
        !job.resources!.some((key) => other.resources!.some((otherKey) => preparationResourcesOverlap(key, otherKey))),
    );
  };
  const candidates = () => [
    ...queued,
    ...pool.slots.flatMap((slot) => (!slot.dispatched && slot.active ? [slot.active] : [])),
  ];
  const nextFor = (slot: PreparationWorkerSlot) => {
    const pending = candidates();
    if (!orderPreparationQueue(pending, queuedPriority, continuations)) return;
    // An exclusive job is a barrier: later installs cannot starve a watcher,
    // global scan or adoption by continually filling the other slot.
    const barrier = pending.findIndex((job) => !job.resources);
    const available = barrier < 0 ? pending : pending.slice(0, barrier + 1);
    return available.find((job) => {
      if (!orderPreparationQueue([job], queuedPriority, continuations)) return false;
      const owner = pool.slots.find((other) => other.active === job);
      return (!owner || owner === slot) && compatible(job, slot);
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
    if (!job) {
      slot.worker?.unref();
      return;
    }
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
  const preemptBuildBlockers = () => {
    for (const waiting of pool.slots) {
      if (!waiting.dispatched || !waiting.active || !waiting.waitingBuilds) continue;
      for (const holder of pool.slots)
        if (
          holder !== waiting &&
          holder.dispatched &&
          holder.active &&
          holder.activeBuilds &&
          activePreparationPriority(waiting.active, queuedPriority) <
            activePreparationPriority(holder.active, queuedPriority)
        )
          pool.replace(holder, holder.active);
    }
  };
  const schedule = (backgroundReady = false) => {
    if (!stopping) preemptBuildBlockers();
    pump(backgroundReady);
    if (stopping) return;
    const pending = candidates();
    if (!orderPreparationQueue(pending, queuedPriority, continuations) || !pending[0]) return;
    const next = pending[0];
    // Use an eligible idle slot before retiring background work. Exclusive
    // requests must wait for both owners, so retire each lower-priority blocker.
    if (pool.slots.some((slot) => !slot.active && !slot.restarting && compatible(next, slot))) return;
    const running = pool.slots.filter((slot) => slot.dispatched && slot.active);
    const blockers = running.filter(
      (slot) =>
        !next.resources ||
        !slot.active!.resources ||
        next.resources.some((key) => slot.active!.resources!.some((other) => preparationResourcesOverlap(key, other))),
    );
    const targets = blockers.length ? blockers : [...running].reverse().slice(0, 1);
    for (const slot of targets)
      if (queuedPriority(next) < activePreparationPriority(slot.active!, queuedPriority))
        pool.replace(slot, slot.active);
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
        const slot = pool.slots.find((slot) => slot.active === owned);
        if (slot) {
          if (slot.dispatched && slot.worker) pool.replace(slot);
          else slot.active = undefined;
        }
        schedule();
      });
      schedule();
      return result as Promise<T>;
    },
    stop: (finalCleanup = true) => {
      if (stopping) return stopping;
      continuations.clear();
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
const shared = createPreparationClient(defaultWorker, (homes) => cleanup?.(homes) ?? Promise.resolve(), { workers: 2 });
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
