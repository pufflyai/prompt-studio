import {
  createScopedQueryClient,
  isScopedQueryCancellation,
  matchesQueryDependency,
  type QueryChangeEnvelope,
  type ScopedQuery,
  type ScopedQueryClient,
  viewDataEvents,
} from "@pstdio/sdk/extensions";
import { createRendererQueryLease } from "./renderer-query-lease";
import { type createRendererReadAdmission, rendererReadAdmissionFor } from "./renderer-read-admission";
import type { RendererReadRequest } from "./renderer-read-registry";

export type RendererQueryIdentity = Pick<
  RendererReadRequest<unknown>,
  "queryKey" | "queryScope" | "sourceId" | "dependency"
>;
interface ProgressiveOwner<T> {
  query: ScopedQuery<T>;
  load: RendererReadRequest<T>["load"];
  version: number;
  progress: Set<(value: T) => void>;
  currentProgress?: { version: number; revision: number; signal: AbortSignal; value: T };
  settled: Promise<void>;
  admission: ReturnType<typeof createRendererReadAdmission>;
}
const owners = new WeakMap<object, unknown>();
let nextRuntime = 0;
const keyFor = (input: RendererQueryIdentity) => JSON.stringify([input.queryScope, input.sourceId, input.queryKey]);

const retainedProgress = <T>(owner: ProgressiveOwner<T>) => {
  const current = owner.currentProgress;
  return current &&
    !current.signal.aborted &&
    current.version === owner.version &&
    current.revision === owner.query.inspect().revision
    ? current
    : undefined;
};

const readRendererQuery = async <T>(owner: ProgressiveOwner<T>, signal: AbortSignal, aborted: Promise<never>) => {
  for (;;) {
    signal.throwIfAborted();
    if (owner.query.isDisposed()) throw new DOMException("Query owner is retired", "AbortError");
    if (owner.admission.held()) {
      await Promise.race([owner.admission.settled(), aborted]);
      continue;
    }
    try {
      return await Promise.race([owner.query.read(), aborted]);
    } catch (error) {
      if (signal.aborted || owner.query.isDisposed() || !isScopedQueryCancellation(error)) throw error;
    }
  }
};

/** Progressive publication is an adapter over the same finite-query authority, never another data cache. */
export const createRendererQueryCache = (sharedQueries?: ScopedQueryClient) => {
  const queries =
    sharedQueries ?? createScopedQueryClient({ runtimeId: `native-${++nextRuntime}`, extensionId: "pstdio" });
  const entries = new Map<string, { identity: RendererQueryIdentity; owner: ProgressiveOwner<unknown> }>();
  const prepare = <T>(request: RendererReadRequest<T>) => {
    let owner!: ProgressiveOwner<T>;
    const query = queries.forScope(request.queryScope ?? {}).query({
      id: "native.renderer",
      params: [request.sourceId, request.queryKey],
      dependsOn: [
        viewDataEvents.extensionCatalogChanged.id,
        ...(request.queryEvents ?? []),
        ...(request.sourceId ? [request.sourceId] : []),
      ],
      dependency: request.dependency,
      subscribe: request.subscribe,
      read: async (signal) => {
        const issued = owner.version;
        const revision = owner.query.inspect().revision;
        owner.currentProgress = undefined;
        let publishing = true;
        const publish = (value: T) => {
          if (!publishing || signal.aborted || issued !== owner.version || revision !== owner.query.inspect().revision)
            return;
          owner.currentProgress = { version: issued, revision, signal, value };
          for (const listener of owner.progress) listener(value);
        };
        const child = Promise.resolve().then(() => owner.load(signal, publish));
        owner.settled = child.then(
          () => {},
          () => {},
        );
        try {
          return await child;
        } finally {
          publishing = false;
          if (issued === owner.version) owner.currentProgress = undefined;
        }
      },
    });
    const admission = rendererReadAdmissionFor(
      queries,
      query.key.slice(0, 6),
      request.sourceId ?? request.queryKey,
      request.dependency?.resourceKey ?? request.dependency?.resourceId,
    );
    admission.register(query);
    owner = owners.get(query) as ProgressiveOwner<T>;
    if (!owner) {
      owner = {
        query,
        load: request.load,
        version: 0,
        progress: new Set(),
        settled: Promise.resolve(),
        admission,
      };
      owners.set(query, owner);
    }
    owner.load = request.load;
    owner.admission = admission;
    const { queryKey, queryScope, sourceId, dependency } = request;
    entries.set(keyFor(request), {
      identity: { queryKey, queryScope, sourceId, dependency },
      owner: owner as unknown as ProgressiveOwner<unknown>,
    });
    for (const [key, entry] of entries) if (entry.owner.query.isDisposed()) entries.delete(key);
    return owner;
  };
  return {
    prepare,
    lease(query: ScopedQuery<unknown>, notify: () => void, onInvalidate?: () => boolean) {
      const owner = owners.get(query) as ProgressiveOwner<unknown>;
      return createRendererQueryLease(query, notify, owner.admission, onInvalidate);
    },
    markStale(identity: RendererQueryIdentity) {
      const owner = entries.get(keyFor(identity))?.owner;
      if (!owner || owner.query.isDisposed() || owner.query.inspect().stale) return;
      owner.version++;
      owner.currentProgress = undefined;
      owner.query.invalidate();
    },
    remove(sourceId: string) {
      for (const [key, { identity, owner }] of entries) {
        if (identity.sourceId !== sourceId) continue;
        entries.delete(key);
        owner.version++;
        owner.currentProgress = undefined;
        owner.query.dispose();
      }
    },
    peek<T>(identity: RendererQueryIdentity) {
      const query = entries.get(keyFor(identity))?.owner.query;
      return query && !query.isDisposed()
        ? (query.getSnapshot() as ReturnType<ScopedQuery<T>["getSnapshot"]>)
        : undefined;
    },
    refresh<T>(request: RendererReadRequest<T>, retry = false) {
      const owner = prepare(request);
      owner.version++;
      owner.currentProgress = undefined;
      if (retry) owner.query.cancel();
      owner.query.invalidate();
    },
    holdForMutation(identity: RendererQueryIdentity) {
      const owner = entries.get(keyFor(identity))?.owner;
      if (!owner || owner.query.isDisposed()) return () => {};
      const stop = owner.query.subscribe(() => {}, { automatic: false });
      const resume = owner.admission.hold();
      try {
        owner.admission.refresh(true);
      } catch (error) {
        try {
          resume();
        } finally {
          stop();
        }
        throw error;
      }
      let settled = false;
      return () => {
        if (settled) return;
        settled = true;
        try {
          if (!owner.query.isDisposed()) owner.admission.refresh();
        } finally {
          try {
            resume();
          } finally {
            stop();
          }
        }
      };
    },
    invalidate(sourceId: string, event?: QueryChangeEnvelope) {
      for (const { identity, owner } of entries.values()) {
        if (
          identity.sourceId !== sourceId ||
          !matchesQueryDependency(event, { projectId: identity.queryScope?.projectId, ...identity.dependency })
        )
          continue;
        owner.version++;
        owner.currentProgress = undefined;
        owner.query.invalidate();
      }
    },
    async read<T>(request: RendererReadRequest<T>, signal: AbortSignal, publish: (value: T) => void) {
      const owner = prepare(request);
      owner.progress.add(publish);
      const current = retainedProgress(owner);
      if (current) publish(current.value);
      const stop = owner.query.subscribe(() => {}, { automatic: false });
      const aborted = Promise.withResolvers<never>();
      let draining: Promise<void> | undefined;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        owner.progress.delete(publish);
        stop();
        if (signal.aborted && !owner.query.inspect().automaticObservers) owner.query.cancel();
      };
      const abort = () => {
        // A retiring placement waits only for the child it joined, never a peer's later work.
        draining = owner.settled;
        release();
        aborted.reject(signal.reason);
      };
      signal.addEventListener("abort", abort, { once: true });
      try {
        return await readRendererQuery(owner, signal, aborted.promise);
      } finally {
        if (owner.query.isDisposed()) draining ??= owner.settled;
        signal.removeEventListener("abort", abort);
        release();
        // Cache cancellation settles immediately; a placement's replacement must await the actual child.
        if (draining) await draining;
      }
    },
    dispose() {
      if (!sharedQueries) queries.dispose();
      entries.clear();
    },
  };
};
