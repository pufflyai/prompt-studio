import type { EventRef, ScopedQuery } from "@pstdio/sdk/extensions";
import type { PlanClient } from "./use-plan";

export const plannerQueryDescriptor = <T, Client extends Pick<PlanClient, "queries">>(
  client: Client,
  id: string,
  read: (client: Client, resourceId?: string) => Promise<T>,
  events: readonly EventRef[],
  resourceId?: string,
) => ({
  id: `planner.${id}`,
  params: resourceId ?? null,
  dependency: resourceId ? { resourceId } : undefined,
  events,
  read: () => read(client, resourceId),
});

export const createPlannerQuery = <T, Client extends Pick<PlanClient, "queries">>(
  client: Client,
  id: string,
  read: (client: Client, resourceId?: string) => Promise<T>,
  events: readonly EventRef[],
  resourceId?: string,
) => client.queries.query(plannerQueryDescriptor(client, id, read, events, resourceId));

/** A partial configuration acknowledgement preserves live fields, then reconciles their latest values. */
export const updatePlannerQuery = <T>(query: ScopedQuery<T>, update: (current: T | undefined) => T | undefined) => {
  const accepted = update(query.getSnapshot().data);
  if (accepted !== undefined) query.accept(accepted);
  query.invalidate();
};
