import { PstdioConnectionError } from "@pstdio/sdk/client";
import type { QueryDependency, QueryScope } from "@pstdio/sdk/extensions";
import { startTransition, useEffect, useRef, useState } from "react";
import type { Disposable, RendererReadBinding, WorkbenchCore } from "../../core";
import { createRendererMutationBinding } from "./renderer-mutations";
import { useWorkbenchConnection } from "./workbench-connection-provider";

interface RendererReadOptions<T> {
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
  load(signal: AbortSignal, publish: (value: T) => void): Promise<T> | T;
  /** Hydrate presentation controllers for both shared and newly loaded values. */
  onAccept?(value: T): void;
  onInvalidate?(): boolean;
  subscribe?(listener: () => void): Disposable | (() => void);
}

interface ReadState<T> {
  queryKey: string;
  request?: symbol;
  value?: T;
  loading: boolean;
  error?: Error;
}

export const useRendererRead = <T>(options: RendererReadOptions<T>) => {
  const { workbench, ownerKey, queryKey, refreshKey } = options;
  const connected = useWorkbenchConnection();
  const scopeKey = JSON.stringify([options.queryScope, options.sourceId, options.dependency, options.queryEvents]);
  const [scopeRevision, setScopeRevision] = useState(0);
  const identity = JSON.stringify([queryKey, scopeKey, scopeRevision]);
  const warm = workbench.views.reads.peek<T>({ ...options, queryKey: JSON.stringify([queryKey, refreshKey]) });
  const [state, setState] = useState<ReadState<T>>(() => ({
    queryKey: identity,
    value: warm?.data,
    loading: warm?.data === undefined,
    error: warm?.error,
  }));
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
  useEffect(() => {
    callbacks.current = options;
  });
  // Query identity controls ownership. Rendering a new callback must not start another read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A connection change reloads views after missed sync events, including local contributions.
  useEffect(() => {
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
      onValue: (value: T, request: symbol) => {
        clearReconnectTimer();
        // Loaded contents may render many rows. Navigation structure and input keep priority.
        startTransition(() => setState({ queryKey: identity, request, value: owner.value() ?? value, loading: false }));
      },
      onError: (error: unknown) => {
        clearReconnectTimer();
        const connectionLost = error instanceof PstdioConnectionError;
        const readError = error instanceof Error ? error : new Error(String(error));
        setState((previous) => ({
          queryKey: identity,
          request: previous.queryKey === identity ? previous.request : undefined,
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
      setState((previous) =>
        previous.queryKey === identity
          ? { ...previous, loading: true, error: undefined }
          : {
              queryKey: identity,
              value: warm?.data,
              loading: warm?.data === undefined,
            },
      );
      const current = callbacks.current;
      const revision = owner.revision();
      const request = Symbol();
      return binding.request(
        {
          ...handlers,
          // A changed read scope cancels older work without clearing the mounted view's snapshot.
          queryKey: JSON.stringify([queryKey, current.refreshKey]),
          queryScope: current.queryScope,
          sourceId: current.sourceId,
          queryEvents: current.queryEvents,
          dependency: current.dependency,
          onInvalidate: current.onInvalidate,
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
            return (sameQuery ? latest : current).load(signal, publish);
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
            handlers.onValue(value, request);
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
  }, [workbench, ownerKey, queryKey, scopeKey, scopeRevision, connected]);
  useEffect(() => {
    if (lastRefreshKey.current === refreshKey) return;
    lastRefreshKey.current = refreshKey;
    refreshRef.current?.();
  }, [refreshKey]);
  const current =
    state.queryKey === identity
      ? state
      : { queryKey: identity, value: warm?.data, loading: warm?.data === undefined, error: warm?.error };
  const connectionLost = current.error instanceof PstdioConnectionError;
  return {
    ...current,
    error: connectionLost ? undefined : current.error?.message,
    loading: current.loading || (connectionLost && current.value === undefined),
    retry: () => retryRef.current?.() ?? Promise.resolve(),
    mutate: (update: (value: T) => T, save: () => Promise<void> | void) => {
      const owner = mutations.current;
      const finishRead = workbench.views.reads.holdForMutation({
        queryKey: JSON.stringify([queryKey, refreshKey]),
        queryScope: options.queryScope,
        sourceId: options.sourceId,
        dependency: options.dependency,
      });
      const resume = readBinding.current?.hold();
      const operation = owner.begin(update);
      const publish = () => setState((previous) => ({ ...previous, value: owner.value() }));
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
