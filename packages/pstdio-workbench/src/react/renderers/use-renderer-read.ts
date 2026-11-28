import { PstdioConnectionError } from "@pstdio/sdk/client";
import type { QueryDependency, QueryScope } from "@pstdio/sdk/extensions";
import { type RefObject, startTransition, useEffect, useRef, useState } from "react";
import type { Disposable, RendererReadBinding, WorkbenchCore } from "../../core";
import type { RendererReadRequest } from "../../core/registries/views/renderer-read-registry";
import { createRendererMutationBinding } from "./renderer-mutations";
import { useWorkbenchConnection } from "./workbench-connection-provider";

interface RendererReadOptions<T> {
  enabled?: boolean;
  workbench: WorkbenchCore;
  ownerKey: string;
  /** What the read is about. A new key drops the old value and loads again. */
  queryKey: string;
  queryScope?: Partial<QueryScope>;
  sourceId?: string;
  queryEvents?: readonly string[];
  dependency?: QueryDependency;
  /**
   * What the read is asked for, such as a view's filter. A new key loads again but keeps the
   * current value on screen until the new one arrives.
   */
  refreshKey?: string;
  /** The accepted value belongs to this read scope, including results loaded by a peer. */
  load(signal: AbortSignal, publish: (value: T) => void, accepted: T | undefined): Promise<T> | T;
  /** Hydrate presentation controllers for both shared and newly loaded values. */
  onAccept?(value: T): void;
  projectResourceChange?: RendererReadRequest<T>["projectResourceChange"];
  projectionKey?: string;
  onInvalidate?(): boolean;
  subscribe?(listener: () => void): Disposable | (() => void);
}

interface ReadState<T> {
  queryKey: string;
  request?: symbol;
  acceptedKey?: string;
  value?: T;
  loading: boolean;
  error?: Error;
}

const readState = <T>(identity: string, cacheKey: string, snapshot?: { data?: T; error?: Error }): ReadState<T> => ({
  queryKey: identity,
  acceptedKey: snapshot?.data === undefined ? undefined : cacheKey,
  value: snapshot?.data,
  loading: snapshot?.data === undefined,
  error: snapshot?.error,
});

// Navigation can settle as soon as its external store changes. Resume a visible
// placement after React commits that change and disposes any departing binding.
const useRefreshHold = (bindingRef: RefObject<RendererReadBinding | undefined>) => {
  const releases = useRef<Array<() => void>>([]);
  const [revision, setRevision] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: The revision commits completed holds.
  useEffect(() => {
    for (const release of releases.current.splice(0)) release();
  }, [revision]);
  return () => {
    const binding = bindingRef.current;
    if (!binding) return undefined;
    const release = binding.hold();
    return () => {
      if (bindingRef.current !== binding) return release();
      releases.current.push(release);
      setRevision((current) => current + 1);
    };
  };
};

export const useRendererRead = <T>(options: RendererReadOptions<T>) => {
  const { workbench, ownerKey, queryKey, refreshKey, enabled = true } = options;
  const connected = useWorkbenchConnection();
  const scopeKey = JSON.stringify([options.queryScope, options.sourceId, options.dependency, options.queryEvents]);
  const [scopeRevision, setScopeRevision] = useState(0);
  const identity = JSON.stringify([queryKey, scopeKey, scopeRevision]);
  const cacheKey = JSON.stringify([queryKey, refreshKey]);
  const warm = enabled ? workbench.views.reads.peek<T>({ ...options, queryKey: cacheKey }) : undefined;
  const [state, setState] = useState(() => readState(identity, cacheKey, warm));
  const retryRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const refreshRef = useRef<((reason?: "observe") => Promise<void>) | undefined>(undefined);
  const lastRefreshKey = useRef(refreshKey);
  const callbacks = useRef(options);
  // Created once in state, not read from a ref during render, so React Compiler keeps `retry` and
  // `mutate` stable. New functions on every render made kanban boards rebuild every card.
  const [mutationBinding] = useState(createRendererMutationBinding<T>);
  const [initialMutations] = useState(() => mutationBinding.bind(ownerKey, identity));
  const mutations = useRef(initialMutations);
  const saveQueue = useRef(Promise.resolve());
  const readBinding = useRef<RendererReadBinding | undefined>(undefined);
  const holdRefresh = useRefreshHold(readBinding);
  useEffect(() => {
    callbacks.current = options;
  });
  // Query identity controls ownership. Rendering a new callback must not start another read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A connection change reloads views after missed sync events, including local contributions.
  useEffect(() => {
    if (!enabled) return;
    if (!connected) {
      workbench.views.reads.markStale({
        ...callbacks.current,
        queryKey: JSON.stringify([queryKey, callbacks.current.refreshKey]),
      });
      return;
    }
    const binding: RendererReadBinding = workbench.views.reads.bind(ownerKey);
    readBinding.current = binding;
    const owner = mutationBinding.bind(ownerKey, identity);
    mutations.current = owner;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const clearReconnectTimer = () => {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    };
    if (warm?.data !== undefined && owner.accept(warm.data, owner.revision())) callbacks.current.onAccept?.(warm.data);
    const handlers = {
      onValue: (value: T, request: symbol, acceptedKey: string) => {
        clearReconnectTimer();
        // Loaded contents may render many rows. Navigation structure and input keep priority.
        startTransition(() =>
          setState({ queryKey: identity, request, acceptedKey, value: owner.value() ?? value, loading: false }),
        );
      },
      onError: (error: unknown) => {
        clearReconnectTimer();
        const connectionLost = error instanceof PstdioConnectionError;
        const readError = error instanceof Error ? error : new Error(String(error));
        setState((previous) => ({
          queryKey: identity,
          request: previous.queryKey === identity ? previous.request : undefined,
          acceptedKey: previous.queryKey === identity ? previous.acceptedKey : undefined,
          value: previous.queryKey === identity ? previous.value : undefined,
          loading: connectionLost && (previous.queryKey !== identity || previous.value === undefined),
          error: connectionLost ? undefined : readError,
        }));
        if (connectionLost) {
          reconnectTimer = setTimeout(() => void refresh(), 1_000);
        }
      },
    };
    const refresh = (reason?: "retry" | "observe") => {
      clearReconnectTimer();
      if (owner.pending()) return Promise.resolve();
      const current = callbacks.current;
      const requestedKey = JSON.stringify([queryKey, current.refreshKey]);
      setState((previous) => {
        if (previous.queryKey !== identity) return readState(identity, cacheKey, warm);
        // Event-driven refreshes retain the loaded view too. Reconciliation is not another page load.
        if (reason === "observe" && previous.value !== undefined && !previous.error) return previous;
        return { ...previous, loading: true, error: undefined };
      });
      const revision = owner.revision();
      const request = Symbol();
      return binding.request(
        {
          ...handlers,
          // A changed read scope cancels older work without clearing the mounted view's snapshot.
          queryKey: requestedKey,
          queryScope: current.queryScope,
          sourceId: current.sourceId,
          queryEvents: current.queryEvents,
          dependency: current.dependency,
          onInvalidate: current.onInvalidate,
          projectResourceChange: current.projectResourceChange,
          projectionKey: current.projectionKey,
          subscribe: current.subscribe
            ? (invalidate) => {
                const subscription = current.subscribe!(invalidate);
                return typeof subscription === "function" ? subscription : () => subscription.dispose();
              }
            : undefined,
          onRetire: () => {
            setState({ queryKey: identity, loading: true });
            setScopeRevision((revision) => revision + 1);
          },
          load: (signal, publish) => {
            const latest = callbacks.current;
            const latestScope = JSON.stringify([
              latest.queryScope,
              latest.sourceId,
              latest.dependency,
              latest.queryEvents,
            ]);
            // Presentation enrichment can update the loader without changing its query.
            // A surviving peer must still use the original scope after this presenter leaves it.
            const sameQuery =
              latest.workbench === workbench &&
              latest.queryKey === queryKey &&
              latest.refreshKey === current.refreshKey &&
              latestScope === scopeKey;
            return (sameQuery ? latest : current).load(signal, publish, owner.value());
          },
          onProgress: (value: T) => {
            // A replacement keeps even a partial snapshot. Progress within its original read still grows.
            startTransition(() =>
              setState((previous) => {
                if (previous.queryKey === identity && previous.value !== undefined && previous.request !== request)
                  return previous;
                return { queryKey: identity, request, value, loading: true };
              }),
            );
          },
          onValue: (value: T) => {
            if (!owner.accept(value, revision)) return;
            callbacks.current.onAccept?.(value);
            handlers.onValue(value, request, requestedKey);
          },
        },
        reason,
      );
    };
    refreshRef.current = refresh;
    // This read already uses the current refresh key, so the refresh effect below must not repeat it.
    lastRefreshKey.current = callbacks.current.refreshKey;
    retryRef.current = () => {
      setState((previous) => ({ ...previous, loading: previous.value === undefined, error: undefined }));
      return refresh("retry");
    };
    refresh();
    return () => {
      clearReconnectTimer();
      retryRef.current = undefined;
      refreshRef.current = undefined;
      readBinding.current = undefined;
      binding.dispose();
    };
  }, [workbench, ownerKey, queryKey, scopeKey, scopeRevision, connected, enabled]);
  useEffect(() => {
    if (lastRefreshKey.current === refreshKey) return;
    lastRefreshKey.current = refreshKey;
    refreshRef.current?.();
  }, [refreshKey]);
  const current = state.queryKey === identity ? state : readState(identity, cacheKey, warm);
  // A replacement read can still be waiting when a write updates the previously displayed snapshot.
  const previousAccepted =
    enabled &&
    options.projectionKey &&
    current.acceptedKey &&
    current.acceptedKey !== cacheKey &&
    warm?.data === undefined
      ? workbench.views.reads.peek<T>({ ...options, queryKey: current.acceptedKey })?.data
      : undefined;
  const connectionLost = current.error instanceof PstdioConnectionError;
  return {
    ...current,
    acceptedValue: warm?.error ? current.value : (warm?.data ?? previousAccepted ?? current.value),
    error: connectionLost ? undefined : current.error?.message,
    loading: current.loading || (connectionLost && current.value === undefined),
    retry: () => retryRef.current?.() ?? Promise.resolve(),
    holdRefresh,
    mutate: (update: (value: T) => T, save: () => Promise<void> | void) => {
      const owner = mutations.current;
      const finishRead = workbench.views.reads.holdForMutation({
        queryKey: cacheKey,
        queryScope: options.queryScope,
        sourceId: options.sourceId,
        dependency: options.dependency,
      });
      const resume = readBinding.current?.hold();
      const operation = owner.begin(update);
      const publish = () =>
        setState((previous) => {
          const value = owner.value();
          return value === previous.value ? previous : { ...previous, value };
        });
      publish();
      const pending = saveQueue.current.then(save);
      saveQueue.current = pending.catch(() => undefined);
      return pending
        .then(
          () => owner.finish(operation, true),
          (error: unknown) => {
            owner.finish(operation, false);
            throw error;
          },
        )
        .finally(() => {
          // Acknowledgements retire the old read even after its presentation has left the project.
          finishRead();
          if (mutations.current === owner) {
            publish();
            if (!owner.pending()) void refreshRef.current?.("observe");
          }
          resume?.();
        });
    },
  };
};
