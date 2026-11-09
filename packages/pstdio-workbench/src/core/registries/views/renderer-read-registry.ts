import type {
  QueryChangeEnvelope,
  QueryDependency,
  QueryScope,
  ScopedQuery,
  ScopedQueryClient,
} from "@pstdio/sdk/extensions";
import { createRendererQueryCache } from "./renderer-query-cache";
import type { createRendererQueryLease } from "./renderer-query-lease";
export interface RendererReadRequest<T> {
  queryKey: string;
  queryScope?: Partial<QueryScope>;
  sourceId?: string;
  queryEvents?: readonly string[];
  dependency?: QueryDependency;
  subscribe?(invalidate: () => void): () => void;
  load(signal: AbortSignal, publish: (value: T) => void): Promise<T> | T;
  onProgress?(value: T): void;
  onRetire?(): void;
  /** Replace pagination parameters before the old query can admit another read. */
  onInvalidate?(): boolean;
  onValue(value: T): void;
  onError(error: unknown): void;
}

interface ReadJob {
  token: symbol;
  generation: number;
  run(signal: AbortSignal): Promise<void>;
  onError(error: unknown): void;
}

interface ReadOwner {
  binding?: symbol;
  query?: ScopedQuery<unknown>;
  lease?: ReturnType<typeof createRendererQueryLease>;
  notify?(): void;
  generation: number;
  pending?: ReadJob;
  active?: { controller: AbortController; settled: Promise<void> };
  queued: boolean;
  waiters: Set<() => void>;
}

export interface RendererReadBinding {
  request<T>(request: RendererReadRequest<T>, reason?: "refresh" | "retry" | "observe"): Promise<void>;
  hold(): () => void;
  dispose(): void;
}

export interface RendererReadRegistry {
  bind(key: string): RendererReadBinding;
  peek: ReturnType<typeof createRendererQueryCache>["peek"];
  holdForMutation: ReturnType<typeof createRendererQueryCache>["holdForMutation"];
  markStale: ReturnType<typeof createRendererQueryCache>["markStale"];
  invalidate(sourceId: string, event?: QueryChangeEnvelope): void;
  dispose(): Promise<void>;
}

const caches = new WeakMap<RendererReadRegistry, ReturnType<typeof createRendererQueryCache>>();
/** Internal projections borrow the existing query owner; they never create another cache root. */
export const getRendererReadCache = (registry: RendererReadRegistry) => caches.get(registry)!;

export const createRendererReadRegistry = (
  input: {
    queries?: ScopedQueryClient;
    subscribeRefresh?(invalidate: RendererReadRegistry["invalidate"]): () => void;
  } = {},
): RendererReadRegistry => {
  const cache = createRendererQueryCache(input.queries);
  const stopRefresh = input.subscribeRefresh?.(cache.invalidate);
  const owners = new Map<string, ReadOwner>();
  let disposed = false;
  const release = (key: string, owner: ReadOwner) => {
    if (!owner.active && !owner.pending && !owner.queued) {
      for (const finish of owner.waiters) finish();
      owner.waiters.clear();
    }
    if (!owner.binding && !owner.active && !owner.pending && owners.get(key) === owner) owners.delete(key);
  };
  const isCurrent = (owner: ReadOwner, job: ReadJob) =>
    owner.binding === job.token && owner.generation === job.generation;
  const schedule = (key: string, owner: ReadOwner) => {
    if (owner.queued || owner.active || disposed) return;
    owner.queued = true;
    queueMicrotask(() => {
      owner.queued = false;
      const job = owner.pending;
      if (!job || disposed || owner.active) {
        release(key, owner);
        return;
      }
      owner.pending = undefined;
      if (!isCurrent(owner, job)) {
        release(key, owner);
        return;
      }
      const controller = new AbortController();
      const settled = Promise.resolve()
        .then(() => job.run(controller.signal))
        .catch((error) => {
          if (!controller.signal.aborted && isCurrent(owner, job)) job.onError(error);
        })
        .finally(() => {
          owner.active = undefined;
          if (owner.pending) schedule(key, owner);
          release(key, owner);
        });
      owner.active = { controller, settled };
    });
  };

  const registry: RendererReadRegistry = {
    peek: cache.peek,
    holdForMutation: cache.holdForMutation,
    markStale: cache.markStale,
    invalidate: cache.invalidate,
    bind(key) {
      if (disposed) throw new Error("Read registry is disposed");
      const owner = owners.get(key) ?? { generation: 0, queued: false, waiters: new Set<() => void>() };
      owners.set(key, owner);
      owner.active?.controller.abort();
      owner.lease?.dispose();
      owner.lease = undefined;
      owner.query = undefined;
      owner.notify = undefined;
      owner.pending = undefined;
      const token = Symbol(key);
      let requested = false;
      owner.binding = token;
      owner.generation++;
      return {
        hold: () => owner.lease?.hold() ?? (() => {}),
        request<T>(request: RendererReadRequest<T>, reason: "refresh" | "retry" | "observe" = "refresh") {
          if (owner.binding !== token || disposed) return Promise.resolve();
          const query = cache.prepare(request).query;
          const changed = owner.query !== query;
          if (changed || reason === "retry") {
            owner.generation++;
            owner.active?.controller.abort();
          }
          if (changed) {
            owner.lease?.dispose();
            owner.query = query as ScopedQuery<unknown>;
            owner.lease = cache.lease(owner.query, () => owner.notify?.(), request.onInvalidate);
          }
          if (reason !== "observe" && ((requested && !changed) || reason === "retry"))
            cache.refresh(request, reason === "retry");
          else cache.prepare(request);
          requested = true;
          // A queued refresh supersedes progress and publication from the older presentation job.
          owner.generation++;
          const generation = owner.generation;
          let published = false;
          let lastValue: T;
          let lastError: unknown;
          const publishError = (error: unknown) => {
            if (owner.binding !== token || owner.generation !== generation || error === lastError) return;
            lastError = error;
            request.onError(error);
          };
          const publishValue = (value: T) => {
            if (owner.binding !== token || owner.generation !== generation) return;
            if (published && value === lastValue && lastError === undefined) return;
            lastError = undefined;
            published = true;
            lastValue = value;
            request.onValue(value);
          };
          owner.notify = () => {
            if (query.isDisposed() && owner.binding === token) {
              owner.generation++;
              owner.active?.controller.abort();
              request.onRetire?.();
              return;
            }
            const snapshot = query.getSnapshot();
            if (!snapshot.fetching && snapshot.error) publishError(snapshot.error);
            if (!snapshot.fetching && !snapshot.error && snapshot.data !== undefined) publishValue(snapshot.data);
          };
          let finish!: () => void;
          const completed = new Promise<void>((resolve) => {
            finish = resolve;
          });
          owner.waiters.add(finish);
          const job: ReadJob = {
            token,
            generation,
            onError: publishError,
            async run(signal) {
              signal.throwIfAborted();
              // Retain event-driven freshness only after the placement's admission barrier opens.
              if (!owner.lease?.admit()) return;
              let reading = true;
              const publish = (value: T) => {
                if (reading && !signal.aborted && isCurrent(owner, job)) request.onProgress?.(value);
              };
              let value: T;
              try {
                value = await cache.read(request, signal, publish);
              } finally {
                reading = false;
              }
              if (!signal.aborted && isCurrent(owner, job)) publishValue(value);
            },
          };
          owner.pending = job;
          schedule(key, owner);
          return completed;
        },
        dispose() {
          if (owner.binding !== token) return;
          owner.binding = undefined;
          owner.lease?.dispose();
          owner.lease = undefined;
          owner.query = undefined;
          owner.notify = undefined;
          owner.pending = undefined;
          owner.generation++;
          owner.active?.controller.abort();
          release(key, owner);
        },
      };
    },
    async dispose() {
      disposed = true;
      const projections = cache.dispose();
      stopRefresh?.();
      const pending: Promise<void>[] = [];
      for (const [key, owner] of owners) {
        owner.binding = undefined;
        owner.lease?.dispose();
        owner.lease = undefined;
        owner.query = undefined;
        owner.pending = undefined;
        if (owner.active) {
          owner.active.controller.abort();
          pending.push(owner.active.settled);
        }
        release(key, owner);
      }
      await Promise.allSettled(pending);
      await projections;
    },
  };
  caches.set(registry, cache);
  return registry;
};
