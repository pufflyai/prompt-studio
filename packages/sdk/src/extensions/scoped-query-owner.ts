import { isCancelledError, type QueryClient, type QueryKey, QueryObserver } from "@tanstack/query-core";
import { runQueryCleanup } from "./query-cleanup";
import { createQueryReadScheduler } from "./query-read-scheduler";
import { createQueryReadSignals } from "./query-read-signals";
import type { ScopedQuery, ScopedQueryDescriptor, ScopedQuerySnapshot } from "./scoped-query";
import { createQueryLedger } from "./scoped-query-ledger";
import { readScopedQueryMembership } from "./scoped-query-read-membership";
import { createQueryReadOptions } from "./scoped-query-read-options";
import { shareQueryValue } from "./share-query-value";

const sameSnapshot = <T>(a: ScopedQuerySnapshot<T>, b: ScopedQuerySnapshot<T>) =>
  a.data === b.data && a.loading === b.loading && a.fetching === b.fetching && a.error === b.error;

const restoreQueryError = (
  client: QueryClient,
  queryKey: QueryKey,
  expected: Error | undefined,
  actual: Error | null,
) => {
  if (actual === (expected ?? null)) return;
  client
    .getQueryCache()
    .find({ queryKey, exact: true })
    ?.setState({
      error: expected ?? null,
      status: expected ? "error" : "success",
      fetchStatus: "idle",
    });
};

const refreshMembership = <T>(owner: Pick<ScopedQuery<T>, "read" | "invalidate">, signal?: AbortSignal) => {
  if (signal?.aborted) return Promise.reject(signal.reason);
  owner.invalidate();
  return owner.read(signal);
};

const cancelQueryRequest = (client: QueryClient, queryKey: QueryKey) => {
  void client.cancelQueries({ queryKey, exact: true }, { revert: false, silent: true });
  client.getQueryCache().find({ queryKey, exact: true })?.setState({ fetchStatus: "idle" });
};

export const createQueryOwner = <T>(
  client: QueryClient,
  queryKey: QueryKey,
  descriptor: ScopedQueryDescriptor<T>,
  retire: () => void,
) => {
  const ledger = createQueryLedger<T>();
  let disposed = false;
  let running: Promise<T> | undefined;
  let stopEvents: (() => void) | undefined;
  let stopObserver: (() => void) | undefined;
  let sourceDetached = false;
  let requiredRead = false;
  const listeners = new Map<symbol, { notify(): void; automatic: boolean }>();
  const invalidationListeners = new Map<symbol, () => void>();
  const signals = createQueryReadSignals(() => disposed);
  let automaticReaders = 0;
  const scheduleRead = createQueryReadScheduler(
    () => !disposed && automaticReaders > 0 && ledger.dirty(),
    () => read(true),
  );
  const assertOpen = () => {
    if (disposed) throw new Error("Query owner is disposed");
  };
  const options = createQueryReadOptions({
    client,
    queryKey,
    ledger,
    read: (signal) => signals.read(signal, descriptor.read),
    assertOpen,
  });
  const observer = new QueryObserver<T, Error>(client, { ...options, enabled: false });
  let snapshotRevision = ledger.revision();
  let snapshot: ScopedQuerySnapshot<T> = { data: client.getQueryData<T>(queryKey), loading: false, fetching: false };
  const cancelRequest = () => cancelQueryRequest(client, queryKey);

  const publish = () => {
    if (disposed) return;
    const result = observer.getCurrentResult();
    const stale = ledger.dirty();
    const accepted = ledger.current();
    if (accepted) restoreQueryError(client, queryKey, accepted.error, result.error);
    const selected = accepted ?? (stale ? snapshot : result);
    const fetching = result.isFetching || (ledger.dirty() && Boolean(running));
    const next = {
      data: selected.data,
      loading: selected.data === undefined && fetching,
      fetching,
      error: selected.error ?? undefined,
    };
    // A successful new revision must wake lifetime adapters even when its data structurally shares every value.
    const revision = !stale && !fetching ? ledger.revision() : snapshotRevision;
    if (sameSnapshot(next, snapshot) && revision === snapshotRevision) return;
    snapshotRevision = revision;
    snapshot = next;
    for (const listener of listeners.values()) listener.notify();
  };
  const read = (automatic = false) => {
    if (disposed) return Promise.reject(new Error("Query owner is disposed"));
    if (!automatic) requiredRead = true;
    if (running) return running;
    const needsFollowUp = (error?: unknown) =>
      ledger.dirty() && (requiredRead || automaticReaders > 0) && !isCancelledError(error);
    const run = async () => {
      // Explicit readers also reconcile a custom source that lost its cursor.
      // Keep that gap until observation resumes; further unobserved reads may miss changes too.
      if (sourceDetached) invalidate();
      for (;;) {
        assertOpen();
        try {
          const value = await client.fetchQuery<T>(options);
          assertOpen();
          if (!needsFollowUp()) return ledger.resolve(value);
          // Invalidation can arrive after queryFn returns, before TanStack commits its result.
          await client.invalidateQueries({ queryKey, exact: true, refetchType: "none" });
        } catch (error) {
          assertOpen();
          if (needsFollowUp(error)) continue;
          return ledger.recover(error);
        }
      }
    };
    const completed = Promise.withResolvers<T>();
    const pending = completed.promise.finally(() => {
      running = undefined;
      requiredRead = false;
      if (disposed) return;
      observer.updateResult();
      publish();
      if (!disposed && ledger.dirty() && automaticReaders) scheduleRead();
      if (!disposed && !listeners.size && !running) {
        stopObserver?.();
        stopObserver = undefined;
        retire();
      }
    });
    running = pending;
    void run().then(completed.resolve, completed.reject);
    return pending;
  };
  const invalidate = () => {
    if (disposed) return;
    ledger.invalidate();
    void client.invalidateQueries({ queryKey, exact: true, refetchType: "none" });
    runQueryCleanup([
      ...invalidationListeners.values(),
      () => {
        if (automaticReaders) scheduleRead();
      },
    ]);
  };
  const owner = {
    key: queryKey,
    getSnapshot: () => snapshot,
    read: (signal?: AbortSignal): Promise<T> => (signal ? readScopedQueryMembership(owner, signal) : read()),
    refresh: (signal?: AbortSignal): Promise<T> => refreshMembership(owner, signal),
    /** Refresh visible data without giving the awaiting caller a required-read lease. */
    async refreshObserved() {
      invalidate();
      if (automaticReaders) await read(true);
    },
    invalidate,
    /** Cheap adapter notification before automatic admission; does not retain optional observation. */
    subscribeInvalidation(listener: () => void) {
      assertOpen();
      const token = Symbol();
      invalidationListeners.set(token, listener);
      return () => {
        invalidationListeners.delete(token);
      };
    },
    cancel() {
      if (disposed) return;
      ledger.invalidate();
      cancelRequest();
    },
    accept(value: T) {
      if (disposed) return;
      if (value === undefined) throw new Error("A scoped query must accept a value; use null for an empty result.");
      const accepted = ledger.accept(shareQueryValue(client.getQueryData<T>(queryKey), value));
      // Cancel work and guard cache publication even if its retryer has already resolved.
      cancelRequest();
      client.setQueryData(queryKey, accepted.data);
      observer.updateResult();
      publish();
    },
    /** Schedulers may observe passively while retaining control of read admission. */
    subscribe(listener: () => void, input: { automatic?: boolean } = {}) {
      if (disposed) throw new Error("Query owner is disposed");
      const first = listeners.size === 0;
      const token = Symbol();
      const automatic = input.automatic !== false;
      listeners.set(token, { notify: listener, automatic });
      if (automatic) automaticReaders++;
      if (first) {
        // Subscribe before reading so an event racing admission cannot be missed.
        stopEvents = descriptor.subscribe?.(invalidate);
        stopObserver ??= observer.subscribe(publish);
        if (sourceDetached) {
          sourceDetached = false;
          invalidate();
        }
      }
      if (automatic) void read(true).catch(() => undefined);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (!listeners.delete(token)) return;
        if (automatic) automaticReaders--;
        if (listeners.size) return;
        const interruptedRead = observer.getCurrentResult().isFetching && !ledger.current();
        sourceDetached = Boolean(descriptor.subscribe);
        stopEvents?.();
        stopEvents = undefined;
        // A coalesced explicit caller still owns the actual read after presentation leaves.
        if (!requiredRead) {
          stopObserver?.();
          stopObserver = undefined;
        }
        // TanStack cancels the last observer's unfinished read. A returning observer
        // must reconcile after that child drains, even when no source event arrived.
        if (interruptedRead && !requiredRead) invalidate();
        retire();
      };
    },
    reportError(cause: unknown) {
      if (disposed) return;
      const accepted = ledger.accept(snapshot.data, cause instanceof Error ? cause : new Error(String(cause)));
      cancelRequest();
      client.getQueryCache().find({ queryKey, exact: true })?.setState({
        error: accepted.error,
        status: "error",
        fetchStatus: "idle",
      });
      observer.updateResult();
      publish();
    },
    isDisposed: () => disposed,
    active: () => listeners.size > 0 || Boolean(running),
    inspect: () => ({
      observers: listeners.size,
      automaticObservers: automaticReaders,
      revision: ledger.revision(),
      stale: ledger.dirty(),
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      ledger.invalidate();
      const query = observer.getCurrentQuery();
      const notices = [...listeners.values()];
      snapshot = { data: undefined, loading: false, fetching: false };
      listeners.clear();
      invalidationListeners.clear();
      automaticReaders = 0;
      // TanStack aborts during removal. Defer source callouts until that cache entry is gone.
      runQueryCleanup([
        () => client.getQueryCache().remove(query),
        () => stopObserver?.(),
        () => observer.destroy(),
        signals.abort,
        () => stopEvents?.(),
        ...notices.map((listener) => () => listener.notify()),
      ]);
    },
  };
  return owner;
};
