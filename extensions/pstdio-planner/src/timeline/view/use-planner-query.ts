import type { EventRef } from "@pstdio/sdk/extensions";
import { useWebviewQuery, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { plannerQueryDescriptor, updatePlannerQuery } from "./planner-query";
import type { PlanClient } from "./use-plan";

export function usePlannerQuery<T, Client extends Pick<PlanClient, "queries">>(
  client: Client,
  id: string,
  read: (client: Client, resourceId?: string) => Promise<T>,
  events: readonly EventRef[],
  resourceId?: string,
) {
  const state = useWebviewQuery(
    client.queries,
    plannerQueryDescriptor(client, id, read, events, resourceId),
    useWebviewVisibility(),
  );
  const { query } = state;
  return {
    value: state.data,
    error: state.error,
    retry: state.refresh,
    query,
    setValue: (update: (current: T | undefined) => T | undefined) => updatePlannerQuery(query, update),
  };
}
