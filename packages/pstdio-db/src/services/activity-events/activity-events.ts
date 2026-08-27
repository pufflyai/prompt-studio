import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { activity_events } from "../../db/schemas.pg";

export const ACTIVITY_ACTOR_TYPES = ["user", "agent", "system"] as const;
export const ACTIVITY_EVENT_SOURCES = ["ui", "api", "hook", "system", "agent"] as const;

type ActivityEventRecord = typeof activity_events.$inferSelect;

type ActorType = (typeof ACTIVITY_ACTOR_TYPES)[number];
type EventSource = (typeof ACTIVITY_EVENT_SOURCES)[number];

type CursorPayload = {
  createdAt: string;
  id: string;
};

type CreateInput = {
  projectId: string;
  resourceType: string;
  resourceId: string;
  sourceExtensionId?: string | null;
  eventType: string;
  actorType: ActorType;
  actorId?: string;
  source: EventSource;
  summary: string;
  payloadJson: Record<string, unknown>;
};

type ListInput = {
  projectId: string;
  resourceType?: string;
  resourceId?: string;
  eventType?: string;
  fromCreatedAt?: string;
  toCreatedAt?: string;
  cursor?: string;
  limit?: number;
};

const nowTimestamp = () => new Date().toISOString();

const decodeCursor = (value: string) => {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf-8"));
    if (typeof parsed !== "object" || parsed === null) return null;

    const { createdAt, id } = parsed as Partial<CursorPayload>;
    if (typeof createdAt !== "string" || createdAt.length === 0) return null;
    if (typeof id !== "string" || id.length === 0) return null;

    return { createdAt, id };
  } catch {
    return null;
  }
};

const encodeCursor = (value: CursorPayload) => Buffer.from(JSON.stringify(value), "utf-8").toString("base64url");

const resolveLimit = (value?: number) => {
  if (value == null) return 50;
  if (!Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(Math.trunc(value), 200));
};

export const createActivityEventsDBService = (db: DbClient) => {
  const create = async (input: CreateInput) => {
    const record: ActivityEventRecord = {
      id: crypto.randomUUID(),
      project_id: input.projectId,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      source_extension_id: input.sourceExtensionId ?? null,
      event_type: input.eventType,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      source: input.source,
      summary: input.summary,
      payload_json: input.payloadJson,
      created_at: nowTimestamp(),
    };

    await db.insert(activity_events).values(record);
    return record;
  };

  const list = async (input: ListInput) => {
    const resolvedLimit = resolveLimit(input.limit);
    const conditions = [eq(activity_events.project_id, input.projectId)];

    if (input.resourceType) {
      conditions.push(eq(activity_events.resource_type, input.resourceType));
    }

    if (input.resourceId) {
      conditions.push(eq(activity_events.resource_id, input.resourceId));
    }

    if (input.eventType) {
      conditions.push(eq(activity_events.event_type, input.eventType));
    }

    if (input.fromCreatedAt) {
      conditions.push(gte(activity_events.created_at, input.fromCreatedAt));
    }

    if (input.toCreatedAt) {
      conditions.push(lte(activity_events.created_at, input.toCreatedAt));
    }

    if (input.cursor) {
      const cursor = decodeCursor(input.cursor);
      if (cursor) {
        conditions.push(
          or(
            lt(activity_events.created_at, cursor.createdAt),
            and(eq(activity_events.created_at, cursor.createdAt), lt(activity_events.id, cursor.id)),
          )!,
        );
      }
    }

    const rows = await db
      .select()
      .from(activity_events)
      .where(and(...conditions))
      .orderBy(desc(activity_events.created_at), desc(activity_events.id))
      .limit(resolvedLimit + 1);

    const hasMore = rows.length > resolvedLimit;
    const events = hasMore ? rows.slice(0, resolvedLimit) : rows;

    if (!hasMore || events.length === 0) {
      return { events, nextCursor: null };
    }

    const last = events[events.length - 1];
    return {
      events,
      nextCursor: encodeCursor({ createdAt: last.created_at, id: last.id }),
    };
  };

  const listByProject = async (input: Omit<ListInput, "resourceId">) => list(input);

  const listByResource = async (input: ListInput & { resourceType: string; resourceId: string }) => list(input);

  return {
    create,
    listByProject,
    listByResource,
  };
};
