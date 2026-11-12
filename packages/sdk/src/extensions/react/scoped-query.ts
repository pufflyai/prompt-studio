import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { PstdioConnectionError } from "../../client/request";
import type { ScopedQuery } from "../scoped-query";
import type { WebviewCommandQuery } from "../webview-command-query";
import type { createWebviewQueryClient, WebviewQueryDescriptor } from "../webview-query";

type WebviewQueries = ReturnType<typeof createWebviewQueryClient>;
type QueryObservation<T> = Pick<ScopedQuery<T>, "getSnapshot" | "subscribe" | "isDisposed">;
export const useWebviewScope = (client: WebviewQueries) =>
  useSyncExternalStore(client.subscribeScope, client.getScope, client.getScope);

/** Bind finite data to current host identity while retaining earlier project owners for warm return. */
export const useWebviewQuery = <T>(client: WebviewQueries, descriptor: WebviewQueryDescriptor<T>, active = true) => {
  useWebviewScope(client);
  const query = client.query(descriptor);
  return { ...useScopedQuery(query, active), query };
};

/** Observe an existing query owner without owning its cache or another event subscription. */
export const useScopedQuery = <T>(query: ScopedQuery<T>, active = true) => {
  const snapshot = useScopedQueries([query], active)[0]!;
  const connectionLost = snapshot.error instanceof PstdioConnectionError;
  // Recovery belongs to the displayed page; registration and imperative reads must still settle.
  useEffect(() => {
    if (!active || !connectionLost || snapshot.fetching || query.isDisposed()) return;
    const timer = setTimeout(() => {
      if (!query.isDisposed()) query.invalidate();
    }, 1_000);
    return () => clearTimeout(timer);
  }, [active, connectionLost, snapshot.fetching, query]);
  return {
    ...snapshot,
    error: connectionLost ? undefined : snapshot.error,
    loading: snapshot.loading || (connectionLost && snapshot.data === undefined),
    refresh: query.invalidate,
    accept: query.accept,
  };
};

/** Observe a read-only host projection; hiding the view releases its optional host membership. */
export const useWebviewCommandQuery = <T>(query: WebviewCommandQuery<T>, active = true) => {
  const snapshot = useScopedQueries([query], active)[0]!;
  const [owner, setOwner] = useState<{ query: WebviewCommandQuery<T>; abort: AbortController }>();
  useLayoutEffect(() => {
    if (!active) return;
    const owner = { query, abort: new AbortController() };
    setOwner(owner);
    return () => {
      owner.abort.abort();
    };
  }, [query, active]);
  const refresh = () => {
    if (!active || !owner || owner.query !== query || owner.abort.signal.aborted) return;
    // UI Retry is optional work; errors are already published in the query snapshot.
    void query.refresh(owner.abort.signal).catch(() => {});
  };
  return { ...snapshot, refresh };
};

const selectQueries = <T>(queries: readonly QueryObservation<T>[]) => {
  let snapshots = queries.map((query) => query.getSnapshot());
  return {
    queries,
    get() {
      const next = queries.map((query) => query.getSnapshot());
      if (next.some((snapshot, index) => snapshot !== snapshots[index])) snapshots = next;
      return snapshots;
    },
    subscribe(listener: () => void) {
      // A layout effect or an earlier source can retire a handle before this passive subscription.
      const stops = [...new Set(queries)].flatMap((query) => (query.isDisposed() ? [] : [query.subscribe(listener)]));
      return () => {
        for (const stop of stops) stop();
      };
    },
  };
};

/** Observe a changing collection of existing owners without conditional hooks or a second cache. */
export const useScopedQueries = <T>(queries: readonly QueryObservation<T>[], active = true) => {
  const [current, setCurrent] = useState(() => selectQueries(queries));
  let selection = current;
  if (queries.length !== current.queries.length || queries.some((query, index) => query !== current.queries[index])) {
    selection = selectQueries(queries);
    setCurrent(selection);
  }
  return useSyncExternalStore(active ? selection.subscribe : () => () => {}, selection.get, selection.get);
};
