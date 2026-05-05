import type { RouteDeps } from "../deps";

type EmitActivityEventInput = {
  projectId: string;
  resourceType: string;
  resourceId: string;
  sourceExtensionId?: string | null;
  eventType: string;
  summary: string;
  payload: Record<string, unknown>;
};

type ListActivityInput = {
  projectId: string;
  resourceType?: string;
  resourceId?: string;
  eventType?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export const emitActivityEvent = async (
  deps: Pick<RouteDeps, "activityEventsService">,
  input: EmitActivityEventInput,
) => {
  await deps.activityEventsService.create({
    projectId: input.projectId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    sourceExtensionId: input.sourceExtensionId ?? null,
    eventType: input.eventType,
    actorType: "system",
    source: "api",
    summary: input.summary,
    payloadJson: input.payload,
  });
};

export const listActivityEvents = async (deps: Pick<RouteDeps, "activityEventsService">, input: ListActivityInput) => {
  if (input.resourceType && input.resourceId) {
    const listed = await deps.activityEventsService.listByResource({
      projectId: input.projectId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      eventType: input.eventType,
      fromCreatedAt: input.from,
      toCreatedAt: input.to,
      cursor: input.cursor,
      limit: input.limit,
    });
    return { events: listed.events, next_cursor: listed.nextCursor };
  }

  const listed = await deps.activityEventsService.listByProject({
    projectId: input.projectId,
    resourceType: input.resourceType,
    eventType: input.eventType,
    fromCreatedAt: input.from,
    toCreatedAt: input.to,
    cursor: input.cursor,
    limit: input.limit,
  });
  return { events: listed.events, next_cursor: listed.nextCursor };
};

export const buildDiff = <T>(from: T, to: T) => ({ from, to });
