import { type QueryKey, type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RendererEventReference } from "pstdio-api-contracts/extension-kernel";
import { useEffect, useRef } from "react";
import type { WebviewEventsClient } from "../webview-events";

interface CommandQueryInput<TResult> {
  queryKey: QueryKey;
  command: () => Promise<TResult>;
  enabled?: boolean;
  staleTime?: number;
  /** Refetch for matching extension events and after the host reconnects. */
  refreshOn?: { client: { events: WebviewEventsClient }; events: readonly RendererEventReference[] };
}

/** Reads server state via a typed client command, cached and deduped by react-query. */
export const useCommandQuery = <TResult>(input: CommandQueryInput<TResult>) => {
  const { command, enabled, queryKey, staleTime, refreshOn } = input;
  const query: UseQueryResult<TResult> = useQuery<TResult>({
    queryKey,
    enabled,
    staleTime,
    queryFn: () => command(),
  });
  const refetch = query.refetch;
  const queryClient = useQueryClient();
  const queryHash = queryClient.defaultQueryOptions({ queryKey }).queryHash;
  const pendingRefresh = useRef<object | null>(null);
  const canRefresh = enabled !== false && Boolean(refreshOn?.events.length);
  // biome-ignore lint/correctness/useExhaustiveDependencies: query and refresh enablement changes end the queued refresh lifetime.
  useEffect(
    () => () => {
      pendingRefresh.current = null;
    },
    [queryClient, queryHash, canRefresh],
  );
  const refreshClient = refreshOn?.client;
  const refreshEvents = refreshOn?.events;
  useEffect(() => {
    if (!refreshClient || !refreshEvents || !canRefresh) return;
    // Keep one queued invalidation across renders. An active read can contain
    // data from before the event, so wait for it and then read once more.
    const refresh = () => {
      if (pendingRefresh.current) return;
      const request = {};
      pendingRefresh.current = request;
      queueMicrotask(async () => {
        await queryClient
          .getQueryCache()
          .get(queryHash)
          ?.promise?.catch(() => {});
        if (pendingRefresh.current !== request) return;
        pendingRefresh.current = null;
        void refetch({ cancelRefetch: false });
      });
    };
    const stops = refreshEvents.map((event) => refreshClient.events.subscribe(event, refresh));
    return () => {
      for (const stop of stops) stop();
    };
  }, [refreshClient, refreshEvents, canRefresh, refetch, queryClient, queryHash]);
  return query;
};

interface CommandMutationInput<TParams, TResult> {
  command: (params: TParams) => Promise<TResult>;
  invalidate?: QueryKey[];
}

/** Writes server state via a typed client command and refreshes affected queries on success. */
export const useCommandMutation = <TParams, TResult>(input: CommandMutationInput<TParams, TResult>) => {
  const { command, invalidate } = input;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: TParams) => command(params),
    onSuccess: () => invalidate?.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey })),
  });
};
