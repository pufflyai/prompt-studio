import { isCancelledError, type QueryClient, type QueryKey, QueryObserver } from "@tanstack/query-core";
import { runQueryCleanup } from "./query-cleanup";
import { createQueryReadScheduler } from "./query-read-scheduler";
import { createQueryReadSignals } from "./query-read-signals";
import type { ScopedQueryDescriptor, ScopedQuerySnapshot } from "./scoped-query";
import { createQueryLedger } from "./scoped-query-ledger";
import { shareQueryValue } from "./share-query-value";

const requireValue = <T>(value: T) => {
  if (value === undefined)
    throw new Error("A scoped query must return or accept a value; use null for an empty result.");
  return value;
};

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
  const listeners = new Map<symbol, { notify(): void; automatic: boolean }>();
  const invalidationListeners = new Map<symbol, () => void>();
  const signals = createQueryReadSignals(() => disposed);
  let automaticReaders = 0;
  const scheduleRead = createQueryReadScheduler(
    () => !disposed && automaticReaders > 0 && ledger.dirty(),
    () => read(),
  );
  const assertOpen = () => {
    if (disposed) throw new Error("Query owner is disposed");
  };
  const assertActive = (signal: AbortSignal) => {
    signal.throwIfAborted();
    assertOpen();
  };
  const options = {
    queryKey,
    retry: false as const,
    staleTime: Infinity,
    gcTime: Infinity,
    // Fence at Query.setData itself: cancelling an already-resolved retryer is too late.
    structuralSharing: (previous: unknown, _next: unknown) => {
      const current = ledger.current();
      return current ? shareQueryValue(previous, current.data) : previous;
    },
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      for (;;) {
        const issued = ledger.revision();
        let value: T;
        try {
          value = requireValue(await signals.read(signal, descriptor.read));
        } catch (error) {
          signal.throwIfAborted();
          if (ledger.fail(issued, client.getQueryData<T>(queryKey), error)) throw error;
          if (!ledger.dirty()) return client.getQueryData<T>(queryKey)!;
          continue;
        }
        assertActive(signal);
        if (ledger.complete(issued, shareQueryValue(client.getQueryData<T>(queryKey), value))) return value;
        // Authoritative mutation/live data supersedes an older read without a second writer.
        if (!ledger.dirty()) return client.getQueryData<T>(queryKey)!;
      }
    },
  };
  const observer = new QueryObserver<T, Error>(client, { ...options, enabled: false });
  let snapshot: ScopedQuerySnapshot<T> = { data: client.getQueryData<T>(queryKey), loading: false, fetching: false };
  const cancelRequest = () => {
    void client.cancelQueries({ queryKey, exact: true }, { revert: false, silent: true });
    client.getQueryCache().find({ queryKey, exact: true })?.setState({ fetchStatus: "idle" });
  };

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
    if (sameSnapshot(next, snapshot)) return;
    snapshot = next;
    for (const listener of listeners.values()) listener.notify();
  };
  const read = () => {
    if (disposed) return Promise.reject(new Error("Query owner is disposed"));
    if (running) return running;
    const run = async () => {
      for (;;) {
        assertOpen();
        try {
          const value = await client.fetchQuery<T>(options);
          assertOpen();
          if (!ledger.dirty()) return ledger.resolve(value);
          // Invalidation can arrive after queryFn returns, before TanStack commits its result.
          await client.invalidateQueries({ queryKey, exact: true, refetchType: "none" });
        } catch (error) {
          assertOpen();
          if (ledger.dirty() && !isCancelledError(error)) continue;
          return ledger.recover(error);
        }
      }
    };
    const completed = Promise.withResolvers<T>();
    const pending = completed.promise.finally(() => {
      running = undefined;
      if (disposed) return;
      observer.updateResult();
      publish();
      if (!disposed && ledger.dirty() && automaticReaders) scheduleRead();
      if (!disposed && !listeners.size) retire();
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
  return {
    key: queryKey,
    getSnapshot: () => snapshot,
    read,
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
        stopObserver = observer.subscribe(publish);
      }
      if (automatic) void read().catch(() => undefined);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (!listeners.delete(token)) return;
        if (automatic) automaticReaders--;
        if (listeners.size) return;
        stopEvents?.();
        stopEvents = undefined;
        stopObserver?.();
        stopObserver = undefined;
        // A detached custom source has no retained cursor; reconcile when observed again.
        if (descriptor.subscribe) invalidate();
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
};
