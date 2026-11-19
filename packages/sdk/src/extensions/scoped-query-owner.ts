import { CancelledError, isCancelledError, type QueryClient, type QueryKey, QueryObserver } from "@tanstack/query-core";
import { runQueryCleanup } from "./query-cleanup";
import { createQueryReadScheduler } from "./query-read-scheduler";
import { createQueryReadSignals } from "./query-read-signals";
import { createQueryReadYield } from "./query-read-yield";
import type { ScopedQuery, ScopedQueryDescriptor } from "./scoped-query";
import { createQueryLedger } from "./scoped-query-ledger";
import { createQueryPublication } from "./scoped-query-publication";
import { runScopedQueryRead } from "./scoped-query-read-cycle";
import { readScopedQueryMembership } from "./scoped-query-read-membership";
import { createQueryReadOptions } from "./scoped-query-read-options";

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
  let cycle: AbortController | undefined;
  let cancelledRevision: number | undefined;
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
  const repeat = createQueryReadYield(() => requiredRead, assertOpen);
  const options = createQueryReadOptions({
    client,
    queryKey,
    ledger,
    read: (signal) => signals.read(signal, descriptor.read),
    assertOpen,
    beforeRepeat: repeat.wait,
  });
  const observer = new QueryObserver<T, Error>(client, { ...options, enabled: false });
  const publication = createQueryPublication({
    client,
    queryKey,
    observer,
    ledger,
    disposed: () => disposed,
    running: () => Boolean(running),
    cancelRequest: () => cancelRequest(),
    resume: repeat.resume,
    notify: () => {
      for (const listener of listeners.values()) listener.notify();
    },
  });
  const { publish } = publication;
  const cancelRequest = () => cancelQueryRequest(client, queryKey);

  const read = (automatic = false) => {
    if (disposed) return Promise.reject(new Error("Query owner is disposed"));
    if (!automatic) {
      requiredRead = true;
      repeat.resume();
    }
    if (running) return running;
    const controller = new AbortController();
    cycle = controller;
    const needsFollowUp = (error?: unknown) =>
      ledger.dirty() && (requiredRead || automaticReaders > 0) && !isCancelledError(error);
    const completed = Promise.withResolvers<T>();
    const pending = completed.promise.finally(() => {
      running = undefined;
      cycle = undefined;
      requiredRead = false;
      if (disposed) return;
      observer.updateResult();
      publish();
      if (ledger.dirty() && automaticReaders && (!controller.signal.aborted || ledger.revision() !== cancelledRevision))
        scheduleRead();
      if (!disposed && !listeners.size && !running) {
        stopObserver?.();
        stopObserver = undefined;
        retire();
      }
    });
    running = pending;
    // Explicit readers reconcile a custom source that lost its cursor.
    if (sourceDetached) invalidate();
    void runScopedQueryRead({
      client,
      queryKey,
      options,
      ledger,
      assertOpen,
      needsFollowUp,
      beforeRepeat: repeat.wait,
      signal: controller.signal,
    }).then(completed.resolve, completed.reject);
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
    getSnapshot: publication.getSnapshot,
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
      cancelledRevision = ledger.revision();
      cycle?.abort(new CancelledError());
      cancelRequest();
      repeat.resume();
    },
    accept(value: T) {
      publication.accept(value);
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
    reportError: publication.reportError,
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
      repeat.resume();
      ledger.invalidate();
      const query = observer.getCurrentQuery();
      const notices = [...listeners.values()];
      publication.clear();
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
