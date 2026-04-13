import type { SQL } from "drizzle-orm";
import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { activity_events } from "../../db/schemas.pg";

type ActivityEventRecord = typeof activity_events.$inferSelect;

export const ACTIVITY_RESOURCE_TYPES = ["ticket", "workspace", "session"] as const;
export const ACTIVITY_ACTOR_TYPES = ["user", "agent", "system"] as const;
export const ACTIVITY_SOURCES = ["ui", "api", "hook", "system", "agent"] as const;

type ActivityResourceType = (typeof ACTIVITY_RESOURCE_TYPES)[number];
type ActivityActorType = (typeof ACTIVITY_ACTOR_TYPES)[number];
type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

type ActivityEventInsert = {
  projectId: string;
  resourceType: ActivityResourceType;
  resourceId: string;
  eventType: string;
  actorType: ActivityActorType;
  actorId?: string;
  source: ActivitySource;
  summary: string;
  payloadJson: Record<string, unknown>;
  createdAt?: string;
};

type ActivityEventListOptions = {
  resourceType?: ActivityResourceType;
  eventType?: string;
  startsAt?: string;
  endsAt?: string;
  cursor?: string;
  limit?: number;
};

type ActivityEventCursor = {
  createdAt: string;
  id: string;
};

const nowTimestamp = () => new Date().toISOString();

const decodeCursor = (cursor: string): ActivityEventCursor => {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const parsed = JSON.parse(decoded) as ActivityEventCursor;
  return parsed;
};

const encodeCursor = (cursor: ActivityEventCursor) => Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

const toActivityEventRecord = (row: typeof activity_events.$inferSelect): ActivityEventRecord => row;

export const createActivityEventsDBService = (db: DbClient) => {
  const create = async (input: ActivityEventInsert) => {
    const timestamp = input.createdAt ?? nowTimestamp();

    const record: typeof activity_events.$inferSelect = {
      id: crypto.randomUUID(),
      project_id: input.projectId,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      event_type: input.eventType,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      source: input.source,
      summary: input.summary,
      payload_json: input.payloadJson,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await db.insert(activity_events).values(record);
    return toActivityEventRecord(record);
  };

  const list = async (projectId: string, options: ActivityEventListOptions = {}, resourceId?: string) => {
    const limit = options.limit ?? 50;
    const conditions: SQL[] = [eq(activity_events.project_id, projectId)];

    if (options.resourceType) {
      conditions.push(eq(activity_events.resource_type, options.resourceType));
    }

    if (resourceId) {
      conditions.push(eq(activity_events.resource_id, resourceId));
    }

    if (options.eventType) {
      conditions.push(eq(activity_events.event_type, options.eventType));
    }

    if (options.startsAt) {
      conditions.push(gte(activity_events.created_at, options.startsAt));
    }

    if (options.endsAt) {
      conditions.push(lte(activity_events.created_at, options.endsAt));
    }

    if (options.cursor) {
      const cursor = decodeCursor(options.cursor);
      conditions.push(
        or(
          lt(activity_events.created_at, cursor.createdAt),
          and(eq(activity_events.created_at, cursor.createdAt), lt(activity_events.id, cursor.id)),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(activity_events)
      .where(and(...conditions))
      .orderBy(desc(activity_events.created_at), desc(activity_events.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items = pageRows.map(toActivityEventRecord);

    if (!hasMore || pageRows.length === 0) {
      return { items, nextCursor: null };
    }

    const tail = pageRows[pageRows.length - 1];
    return {
      items,
      nextCursor: encodeCursor({ createdAt: tail.created_at, id: tail.id }),
    };
  };

  const listByProject = async (projectId: string, options?: ActivityEventListOptions) => list(projectId, options);

  const listByResource = async (
    projectId: string,
    resourceType: ActivityResourceType,
    resourceId: string,
    options?: Omit<ActivityEventListOptions, "resourceType">,
  ) => list(projectId, { ...options, resourceType }, resourceId);

  return { create, listByProject, listByResource };
};

export type {
  ActivityActorType,
  ActivityEventInsert,
  ActivityEventListOptions,
  ActivityEventRecord,
  ActivityResourceType,
  ActivitySource,
};
