import type { ScopedQuery } from "@pstdio/sdk/extensions";
import type { WebviewCommandQuerySnapshot } from "pstdio-api-contracts/extension-kernel";
import { runQueryCallbacks } from "./webview-query-cleanup";

const sources = new WeakMap<ScopedQuery<unknown>, ReturnType<typeof createSource>>();
let generation = 0;
const createSource = (query: ScopedQuery<unknown>) => {
  const issuedGeneration = ++generation;
  let version = 0;
  let previous: ReturnType<typeof query.getSnapshot> | undefined;
  let published: WebviewCommandQuerySnapshot | undefined;
  let stopSnapshot: (() => void) | undefined;
  let stopInvalidation: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const changed = () => runQueryCallbacks([...listeners]);
  return {
    query,
    snapshot() {
      const value = query.getSnapshot();
      const stale = query.inspect().stale;
      const retired = query.isDisposed() ? true : undefined;
      if (published && previous === value && published.stale === stale && published.retired === retired)
        return published;
      previous = value;
      published = {
        generation: issuedGeneration,
        version: ++version,
        data: value.data,
        fetching: value.fetching,
        stale,
        ...(value.error ? { error: { message: value.error.message } } : {}),
        ...(retired ? { retired } : {}),
      };
      return published;
    },
    observe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        stopInvalidation = query.subscribeInvalidation(changed);
        stopSnapshot = query.subscribe(changed);
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        listeners.delete(listener);
        if (listeners.size) return;
        const invalidation = stopInvalidation;
        const snapshot = stopSnapshot;
        stopInvalidation = undefined;
        stopSnapshot = undefined;
        runQueryCallbacks([() => invalidation?.(), () => snapshot?.()]);
      };
    },
  };
};
export const getWebviewQuerySource = (query: ScopedQuery<unknown>) => {
  let source = sources.get(query);
  if (!source) {
    source = createSource(query);
    sources.set(query, source);
  }
  return source;
};
export type WebviewQuerySource = ReturnType<typeof getWebviewQuerySource>;
