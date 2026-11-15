import type { WebviewCommandQuery } from "@pstdio/sdk/extensions";
import { useWebviewCommandQuery, useWebviewScope, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import type { PlanClient } from "./use-plan";

export function usePlannerQuery<T>(client: Pick<PlanClient, "queries">, query: WebviewCommandQuery<T>, active = true) {
  useWebviewScope(client.queries);
  const visible = useWebviewVisibility();
  const state = useWebviewCommandQuery(query, visible && active);
  return {
    value: state.data,
    error: state.error,
    retry: state.refresh,
    query,
  };
}
