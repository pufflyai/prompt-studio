import type { ActivityEvent } from "pstdio-api-contracts";
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

const activityPage = (listed: { events: ActivityEvent[]; nextCursor: string | null }) => ({
  events: listed.events,
  next_cursor: listed.nextCursor,
  items: listed.events.map((event) => ({
    id: event.id,
    projectId: event.project_id,
    resourceType: event.resource_type,
    resourceId: event.resource_id,
    sourceExtensionId: event.source_extension_id,
    eventType: event.event_type,
    actorType: event.actor_type,
    actorId: event.actor_id,
    source: event.source,
    summary: event.summary,
    payloadJson: event.payload_json,
    createdAt: event.created_at,
  })),
  nextCursor: listed.nextCursor,
});

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
    return activityPage(listed);
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
  return activityPage(listed);
};

export const buildDiff = <T>(from: T, to: T) => ({ from, to });
