import type { WebviewCommandQueryEvent, WebviewCommandQuerySnapshot } from "pstdio-api-contracts/extension-kernel";
import { runQueryCleanup } from "./query-cleanup";
import type { ScopedQuerySnapshot } from "./scoped-query";
import { shareQueryValue } from "./share-query-value";
import { createWebviewQueryRequests } from "./webview-query-requests";

export interface WebviewQueryTransport<Definition> {
  current(): boolean;
  seed?: { snapshot: WebviewCommandQuerySnapshot };
  request(
    definition: Definition | undefined,
    operation: "observe" | "read" | "refresh" | "close",
    requestId: string,
  ): Promise<WebviewCommandQuerySnapshot | undefined>;
  listen(listener: (payload: WebviewCommandQueryEvent) => void): () => void;
}

export const createWebviewQueryProjection = <T, Definition>(
  transport: WebviewQueryTransport<Definition>,
  definition: Definition,
  changed: () => void,
) => {
  const listeners = new Map<symbol, () => void>();
  const requests = createWebviewQueryRequests(transport.request, changed);
  let disposed = false;
  let membership: string | undefined;
  let stopEvents: (() => void) | undefined;
  let generation = -1;
  let version = -1;
  let publication = 0;
  let bridgeError = false;
  let snapshot: ScopedQuerySnapshot<T> = { data: undefined, loading: false, fetching: false };
  const current = () => !disposed && transport.current();
  const publish = () => runQueryCleanup([...listeners.values()]);
  const apply = (next: WebviewCommandQuerySnapshot) => {
    if (!current()) return;
    if (next.generation < generation) return;
    if (next.generation !== generation) {
      generation = next.generation;
      version = -1;
    }
    if (next.version < version || (next.version === version && !bridgeError)) return;
    bridgeError = false;
    publication++;
    version = next.version;
    const data = next.retired ? undefined : shareQueryValue(snapshot.data, next.data as T | undefined);
    snapshot = {
      data,
      loading: data === undefined && next.fetching,
      fetching: next.fetching,
      ...(next.error ? { error: new Error(next.error.message) } : {}),
    };
    if (next.retired) dispose();
    else publish();
  };
  const fail = (error: unknown) => {
    if (!current()) return;
    bridgeError = true;
    snapshot = {
      ...snapshot,
      loading: false,
      fetching: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
    publish();
  };
  const detach = () => {
    const previous = membership;
    membership = undefined;
    const stop = stopEvents;
    stopEvents = undefined;
    runQueryCleanup([
      () => stop?.(),
      () => {
        if (previous) requests.close(previous);
      },
      changed,
    ]);
  };
  const observe = () => {
    if (!current()) throw new Error("Retained query authority is closed");
    const requestId = requests.begin();
    membership = requestId;
    const issued = publication;
    stopEvents = transport.listen((payload) => {
      const event = payload as WebviewCommandQueryEvent;
      if (membership !== requestId || event.requestId !== requestId) return;
      apply(event.snapshot);
    });
    void transport.request(definition, "observe", requestId).then(
      (next) => {
        if (membership !== requestId || !next) return;
        apply(next);
      },
      (error) => {
        if (membership === requestId && publication === issued) fail(error);
      },
    );
  };
  const read = async (operation: "read" | "refresh", signal?: AbortSignal) => {
    if (!current()) throw new Error("Command query authority is closed");
    const issued = publication;
    try {
      return await requests.read(definition, operation, signal, (next) => {
        signal?.throwIfAborted();
        if (!current() || !next) throw new Error("Command query authority is closed");
        apply(next);
        if (!current()) throw new Error("Command query authority is closed");
        if (snapshot.error) throw snapshot.error;
        return snapshot.data as T;
      });
    } catch (error) {
      if (!signal?.aborted && publication === issued) fail(error);
      throw error;
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    snapshot = { data: undefined, loading: false, fetching: false };
    const notices = [...listeners.values()];
    listeners.clear();
    runQueryCleanup([detach, requests.dispose, ...notices]);
  };
  // Hydration is synchronous and runs once, before any observation or request can publish.
  const seed = transport.seed;
  if (seed && !seed.snapshot.retired) apply(seed.snapshot);
  return {
    definition,
    hydrate: apply,
    getSnapshot: () => snapshot,
    isDisposed: () => disposed,
    read: (signal?: AbortSignal) => read("read", signal),
    refresh: (signal?: AbortSignal) => read("refresh", signal),
    active: () => listeners.size > 0 || requests.active(),
    dispose,
    subscribe(listener: () => void) {
      if (!current()) throw new Error("Command query authority is closed");
      const first = !listeners.size;
      const token = Symbol();
      listeners.set(token, listener);
      if (first) observe();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        listeners.delete(token);
        if (!listeners.size) detach();
      };
    },
  };
};
