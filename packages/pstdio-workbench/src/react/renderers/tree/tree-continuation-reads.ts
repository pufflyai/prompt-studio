import { createRendererQueryCache } from "../../../core/registries/views/renderer-query-cache";
import type { TreePageIdentity } from "./tree-page-owner";

export class TreeContinuationCancelled extends Error {}

type Cache = ReturnType<typeof createRendererQueryCache>;
interface Job {
  controller: AbortController;
  settled: Promise<unknown>;
  generation: number;
  epoch: number;
}
const pending = new WeakMap<object, Map<string, Set<Job>>>();
let nextGeneration = 0;

/** Continuations and lazy children share finite authority, core admission and actual-child drain. */
export const createTreeContinuationReads = (
  rootKey: readonly unknown[],
  parent: Cache,
  identity: TreePageIdentity,
  input: {
    epoch(): number;
    available(): boolean;
    lifetimes(): Cache[];
  },
) => {
  const generation = ++nextGeneration;
  const cache = createRendererQueryCache(parent.queries);
  const running = new Set<Job>();
  const runtime = pending.get(parent.queries) ?? new Map<string, Set<Job>>();
  pending.set(parent.queries, runtime);
  const key = JSON.stringify(rootKey);
  const abort = () => {
    for (const job of running) job.controller.abort();
  };
  return {
    abort,
    track(lifetime: Cache) {
      for (const job of running) lifetime.track(job.settled);
    },
    dispose() {
      abort();
      return cache.dispose();
    },
    read<T>(params: unknown[], load: (signal: AbortSignal) => Promise<T>, signal: AbortSignal) {
      if (signal.aborted || !input.available())
        return Promise.reject<T>(new DOMException("Tree source is suspended", "AbortError"));
      const controller = new AbortController();
      const stop = () => controller.abort();
      signal.addEventListener("abort", stop, { once: true });
      const siblings = runtime.get(key) ?? new Set<Job>();
      runtime.set(key, siblings);
      const epoch = input.epoch();
      const previous = [...siblings]
        .filter((job) => job.generation !== generation || job.epoch !== epoch)
        .map((job) => job.settled);
      const settled = Promise.resolve()
        .then(async () => {
          await Promise.allSettled(previous);
          controller.signal.throwIfAborted();
          if (epoch !== input.epoch() || !input.available())
            throw new DOMException("Tree source is suspended", "AbortError");
          const value = await cache.read<T>(
            {
              ...identity,
              queryKey: JSON.stringify([identity.queryKey, "tree-continuation", generation, epoch, params]),
              load,
              onValue() {},
              onError() {},
            },
            controller.signal,
            () => {},
          );
          controller.signal.throwIfAborted();
          if (epoch !== input.epoch() || !input.available())
            throw new DOMException("Tree source is suspended", "AbortError");
          return value;
        })
        .catch((error) => {
          if (controller.signal.aborted) throw new TreeContinuationCancelled("Tree presentation left");
          throw error;
        });
      const job = { controller, settled, generation, epoch };
      running.add(job);
      siblings.add(job);
      for (const lifetime of new Set(input.lifetimes())) lifetime.track(settled);
      void settled
        .then(
          () => {},
          () => {},
        )
        .finally(() => {
          running.delete(job);
          siblings.delete(job);
          if (!siblings.size && runtime.get(key) === siblings) runtime.delete(key);
          signal.removeEventListener("abort", stop);
        });
      return settled;
    },
  };
};
