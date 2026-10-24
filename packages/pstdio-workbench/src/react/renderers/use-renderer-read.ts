import { PstdioConnectionError } from "@pstdio/sdk/client";
import { startTransition, useEffect, useRef, useState } from "react";
import type { Disposable, RendererReadBinding, WorkbenchCore } from "../../core";
import { createRendererMutationBinding } from "./renderer-mutations";
import { useWorkbenchConnection } from "./workbench-connection-provider";

interface RendererReadOptions<T> {
  workbench: WorkbenchCore;
  ownerKey: string;
  /** What the read is about. A new key drops the old value and loads again. */
  queryKey: string;
  /**
   * What the read is asked for, such as a view's filter. A new key loads again but keeps the
   * current value on screen until the new one arrives.
   */
  refreshKey?: string;
  load(signal: AbortSignal, publish: (value: T) => void): Promise<T> | T;
  subscribe(listener: () => void): Disposable | (() => void);
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
  const [state, setState] = useState<ReadState<T>>({ queryKey, loading: true });
  const retryRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const refreshRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const lastRefreshKey = useRef(refreshKey);
  const callbacks = useRef(options);
  const mutationBinding = useRef(createRendererMutationBinding<T>());
  const mutations = useRef(mutationBinding.current.bind(ownerKey, queryKey));
  const saveQueue = useRef(Promise.resolve());
  useEffect(() => {
    callbacks.current = options;
  });
  // Query identity controls ownership. Rendering a new callback must not start another read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A connection change reloads views after missed sync events, including local contributions.
  useEffect(() => {
    const binding: RendererReadBinding = workbench.views.reads.bind(ownerKey);
    const owner = mutationBinding.current.bind(ownerKey, queryKey);
    mutations.current = owner;
    const handlers = {
      onValue: (value: T, request: symbol) => {
        // Loaded contents may render many rows. Navigation structure and input keep priority.
        startTransition(() => setState({ queryKey, request, value: owner.value() ?? value, loading: false }));
      },
      onError: (error: unknown) => {
        const connectionLost = error instanceof PstdioConnectionError;
        const readError = error instanceof Error ? error : new Error(String(error));
        setState((previous) => ({
          queryKey,
          request: previous.queryKey === queryKey ? previous.request : undefined,
          value: previous.queryKey === queryKey ? previous.value : undefined,
          loading: false,
          // Retain a loaded snapshot after a dropped response. An initial failure
          // still needs Retry if the host's sync connection has not been lost.
          error:
            connectionLost && previous.queryKey === queryKey && previous.value !== undefined ? undefined : readError,
        }));
      },
    };
    const refresh = (reason?: "retry") => {
      if (owner.pending()) return Promise.resolve();
      setState((previous) => ({ ...previous, loading: true, error: undefined }));
      const current = callbacks.current;
      const revision = owner.revision();
      const request = Symbol();
      return binding.request(
        {
          ...handlers,
          // A changed read scope cancels older work without clearing the mounted view's snapshot.
          queryKey: JSON.stringify([queryKey, current.refreshKey]),
          load: current.load,
          onProgress: (value: T) => {
            // A replacement keeps even a partial snapshot. Progress within its original read still grows.
            startTransition(() =>
              setState((previous) => {
                if (previous.queryKey === queryKey && previous.value !== undefined && previous.request !== request)
                  return previous;
                return { queryKey, request, value, loading: true };
              }),
            );
          },
          onValue: (value: T) => {
            if (owner.accept(value, revision)) handlers.onValue(value, request);
          },
        },
        reason,
      );
    };
    refreshRef.current = () => refresh();
    // This read already uses the current refresh key, so the refresh effect below must not repeat it.
    lastRefreshKey.current = callbacks.current.refreshKey;
    retryRef.current = () => {
      setState((previous) => ({ ...previous, loading: previous.value === undefined, error: undefined }));
      return refresh("retry");
    };
    refresh();
    const subscription = callbacks.current.subscribe(refresh);
    return () => {
      retryRef.current = undefined;
      refreshRef.current = undefined;
      binding.dispose();
      if (typeof subscription === "function") subscription();
      else subscription.dispose();
    };
  }, [workbench, ownerKey, queryKey, connected]);
  useEffect(() => {
    if (lastRefreshKey.current === refreshKey) return;
    lastRefreshKey.current = refreshKey;
    refreshRef.current?.();
  }, [refreshKey]);
  const current = state.queryKey === queryKey ? state : { queryKey, loading: true };
  const connectionLost = current.error instanceof PstdioConnectionError && !connected;
  return {
    ...current,
    error: connectionLost ? undefined : current.error?.message,
    loading: current.loading || (connectionLost && current.value === undefined),
    retry: () => retryRef.current?.() ?? Promise.resolve(),
    mutate: (update: (value: T) => T, save: () => Promise<void> | void) => {
      const owner = mutations.current;
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
          if (mutations.current !== owner) return;
          publish();
          if (!owner.pending()) void refreshRef.current?.();
        });
    },
  };
};
