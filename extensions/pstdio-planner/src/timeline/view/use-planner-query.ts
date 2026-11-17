import type { WebviewCommandQuery } from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery, useWebviewScope, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import type { PlanClient } from "./use-plan";

export function usePlannerQuery<T>(client: Pick<PlanClient, "queries">, query: WebviewCommandQuery<T>) {
  useWebviewScope(client.queries);
  const state = useWebviewCommandQuery(query, useWebviewVisibility());
  return {
    value: state.data,
    error: state.error,
    retry: state.refresh,
    query,
  };
}
