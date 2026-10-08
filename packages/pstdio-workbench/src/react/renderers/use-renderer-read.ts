import { PstdioConnectionError } from "@pstdio/sdk/client";
import { useEffect, useRef, useState } from "react";
import type { Disposable, RendererReadBinding, WorkbenchCore } from "../../core";
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
  value?: T;
  loading: boolean;
  error?: Error;
}

export const useRendererRead = <T>(options: RendererReadOptions<T>) => {
  const { workbench, ownerKey, queryKey, refreshKey } = options;
  const connected = useWorkbenchConnection();
  const [state, setState] = useState<ReadState<T>>({ queryKey, loading: true });
  const retryRef = useRef<(() => void) | undefined>(undefined);
  const refreshRef = useRef<(() => void) | undefined>(undefined);
  const lastRefreshKey = useRef(refreshKey);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });
  // Query identity controls ownership. Rendering a new callback must not start another read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A connection change reloads views after missed sync events, including local contributions.
  useEffect(() => {
    const binding: RendererReadBinding = workbench.views.reads.bind(ownerKey);
    const handlers = {
      onProgress: (value: T) => {
        // Background refreshes keep the complete snapshot until its replacement is ready.
        setState((previous) => {
          if (previous.queryKey === queryKey && previous.value !== undefined && !previous.loading) return previous;
          return { queryKey, value, loading: true };
        });
      },
      onValue: (value: T) => {
        setState({ queryKey, value, loading: false });
      },
      onError: (error: unknown) => {
        const connectionLost = error instanceof PstdioConnectionError;
        const readError = error instanceof Error ? error : new Error(String(error));
        setState((previous) => ({
          queryKey,
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
      const current = callbacks.current;
      binding.request(
        {
          ...handlers,
          // A changed read scope cancels older work without clearing the mounted view's snapshot.
          queryKey: JSON.stringify([queryKey, current.refreshKey]),
          load: current.load,
        },
        reason,
      );
    };
    refreshRef.current = () => refresh();
    // This read already uses the current refresh key, so the refresh effect below must not repeat it.
    lastRefreshKey.current = callbacks.current.refreshKey;
    retryRef.current = () => {
      setState((previous) => ({ ...previous, loading: previous.value === undefined, error: undefined }));
      refresh("retry");
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
    retry: () => retryRef.current?.(),
  };
};
