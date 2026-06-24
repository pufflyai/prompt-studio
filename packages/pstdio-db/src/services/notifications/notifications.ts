import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import type { JsonObject, ResourceRef } from "../../db/schemas/types";
import { notifications } from "../../db/schemas.pg";

export type NotificationRecord = typeof notifications.$inferSelect;

const LIVE_STATUSES = ["open", "read", "snoozed"] as const;
type LiveStatus = (typeof LIVE_STATUSES)[number];

type CreateInput = {
  projectId: string;
  source: string;
  origin: string;
  sourceExtensionId?: string | null;
  actorType?: string | null;
  actorId?: string | null;
  title: string;
  body?: string | null;
  kind: string;
  priority?: string;
  status?: string;
  target?: ResourceRef | null;
  related?: ResourceRef[];
  actions?: unknown[];
  dedupeKey?: string | null;
  metadata?: JsonObject | null;
  snoozedUntil?: string | null;
  expiresAt?: string | null;
};

type UpdateInput = Partial<{
  status: string;
  priority: string;
  snoozedUntil: string | null;
  readAt: string | null;
  resolvedAt: string | null;
  title: string;
  body: string | null;
  kind: string;
  target: ResourceRef | null;
  related: ResourceRef[];
  actions: unknown[];
  metadata: JsonObject | null;
  expiresAt: string | null;
}>;

type ListInput = {
  projectId: string;
  status?: string[];
  priority?: string[];
  sourceExtensionId?: string;
  resourceType?: string;
  resourceId?: string;
  limit?: number;
  cursor?: string;
};

const nowIso = () => new Date().toISOString();

const resolveLimit = (value?: number) => {
  if (value == null) return 50;
  if (!Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(Math.trunc(value), 200));
};

const encodeCursor = (value: { updatedAt: string; id: string }) =>
  Buffer.from(JSON.stringify(value), "utf-8").toString("base64url");

const decodeCursor = (value: string) => {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf-8")) as {
      updatedAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string") return null;
    return { updatedAt: parsed.updatedAt, id: parsed.id };
  } catch {
    return null;
  }
};

const UPDATE_FIELD_MAP = {
  status: "status",
  priority: "priority",
  snoozedUntil: "snoozed_until",
  readAt: "read_at",
  resolvedAt: "resolved_at",
  title: "title",
  body: "body",
  kind: "kind",
  target: "target_json",
  related: "related_json",
  actions: "actions_json",
  metadata: "metadata_json",
  expiresAt: "expires_at",
} as const;

const buildUpdatePatch = (input: UpdateInput): Partial<NotificationRecord> => {
  const patch: Partial<NotificationRecord> = { updated_at: nowIso() };
  for (const [inputKey, recordKey] of Object.entries(UPDATE_FIELD_MAP) as [
    keyof UpdateInput,
    keyof NotificationRecord,
  ][]) {
    const value = input[inputKey];
    if (value !== undefined) {
      (patch as Record<string, unknown>)[recordKey] = value;
    }
  }
  return patch;
};

export const createNotificationsDBService = (db: DbClient) => {
  const findById = async (projectId: string, id: string) => {
    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.project_id, projectId), eq(notifications.id, id)))
      .limit(1);
    return rows[0] ?? null;
  };

  const findLiveByDedupeKey = async (projectId: string, dedupeKey: string) => {
    const rows = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.project_id, projectId),
          eq(notifications.dedupe_key, dedupeKey),
          inArray(notifications.status, LIVE_STATUSES as unknown as LiveStatus[]),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  };

  const create = async (input: CreateInput) => {
    const now = nowIso();
    const record: NotificationRecord = {
      id: crypto.randomUUID(),
      project_id: input.projectId,
      source: input.source,
      origin: input.origin,
      source_extension_id: input.sourceExtensionId ?? null,
      actor_type: input.actorType ?? null,
      actor_id: input.actorId ?? null,
      title: input.title,
      body: input.body ?? null,
      kind: input.kind,
      priority: input.priority ?? "normal",
      status: input.status ?? "open",
      target_json: input.target ?? null,
      related_json: input.related ?? [],
      actions_json: input.actions ?? [],
      metadata_json: input.metadata ?? null,
      dedupe_key: input.dedupeKey ?? null,
      created_at: now,
      updated_at: now,
      read_at: null,
      resolved_at: null,
      snoozed_until: input.snoozedUntil ?? null,
      expires_at: input.expiresAt ?? null,
    };
    await db.insert(notifications).values(record);
    return record;
  };

  const update = async (projectId: string, id: string, input: UpdateInput) => {
    const patch = buildUpdatePatch(input);
    await db
      .update(notifications)
      .set(patch)
      .where(and(eq(notifications.project_id, projectId), eq(notifications.id, id)));
    return findById(projectId, id);
  };

  const list = async (input: ListInput) => {
    const limit = resolveLimit(input.limit);
    const conditions = [eq(notifications.project_id, input.projectId)];

    if (input.status?.length) conditions.push(inArray(notifications.status, input.status));
    if (input.priority?.length) conditions.push(inArray(notifications.priority, input.priority));
    if (input.sourceExtensionId) {
      conditions.push(eq(notifications.source_extension_id, input.sourceExtensionId));
    }
    if (input.resourceType) {
      conditions.push(sql`${notifications.target_json}->>'type' = ${input.resourceType}`);
    }
    if (input.resourceId) {
      conditions.push(sql`${notifications.target_json}->>'id' = ${input.resourceId}`);
    }
    if (input.cursor) {
      const cursor = decodeCursor(input.cursor);
      if (cursor) {
        conditions.push(
          sql`(${notifications.updated_at} < ${cursor.updatedAt}) OR (${notifications.updated_at} = ${cursor.updatedAt} AND ${notifications.id} < ${cursor.id})`,
        );
      }
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.updated_at), desc(notifications.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    if (!hasMore || items.length === 0) return { items, nextCursor: null };
    const last = items[items.length - 1];
    return { items, nextCursor: encodeCursor({ updatedAt: last.updated_at, id: last.id }) };
  };

  const count = async (input: Omit<ListInput, "cursor" | "limit">) => {
    const conditions = [eq(notifications.project_id, input.projectId)];
    if (input.status?.length) conditions.push(inArray(notifications.status, input.status));
    if (input.priority?.length) conditions.push(inArray(notifications.priority, input.priority));
    if (input.sourceExtensionId) {
      conditions.push(eq(notifications.source_extension_id, input.sourceExtensionId));
    }
    const rows = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(notifications)
      .where(and(...conditions));
    return rows[0]?.count ?? 0;
  };

  const listDueSnoozed = async (now: string) => {
    return db
      .select()
      .from(notifications)
      .where(and(eq(notifications.status, "snoozed"), lte(notifications.snoozed_until, now)));
  };

  return { create, update, findById, findLiveByDedupeKey, list, count, listDueSnoozed };
};
