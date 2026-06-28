import { and, desc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { notifications } from "../../db/schemas.pg";

type NotificationRow = typeof notifications.$inferSelect;
type NotificationStatus = "open" | "read" | "snoozed" | "done" | "dismissed" | "expired";
type NotificationPriority = "low" | "normal" | "high" | "urgent";

type CursorPayload = {
  updatedAt: string;
  id: string;
};

type CreateInput = {
  project_id: string;
  source: string;
  origin: string;
  source_extension_id?: string | null;
  actor_type?: string | null;
  actor_id?: string | null;
  title: string;
  body?: string | null;
  kind: string;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  target_json?: Record<string, unknown> | null;
  related_json?: unknown[];
  actions_json?: unknown[];
  metadata_json?: Record<string, unknown> | null;
  dedupe_key?: string | null;
  snoozed_until?: string | null;
  expires_at?: string | null;
  terminalCooldownMs?: number;
};

type ListInput = {
  project_id: string;
  status?: NotificationStatus | NotificationStatus[];
  priority?: NotificationPriority | NotificationPriority[];
  source_extension_id?: string;
  resource_type?: string;
  resource_id?: string;
  cursor?: string;
  limit?: number;
};

type UpdateInput = {
  status?: Exclude<NotificationStatus, "open" | "expired">;
  priority?: NotificationPriority;
  snoozed_until?: string | null;
  metadata_json?: Record<string, unknown> | null;
};

const liveStatuses: NotificationStatus[] = ["open", "read", "snoozed"];
const terminalStatuses: NotificationStatus[] = ["done", "dismissed", "expired"];
const defaultTerminalCooldownMs = 30_000;

const nowTimestamp = () => new Date().toISOString();

const decodeCursor = (value: string) => {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf-8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { updatedAt, id } = parsed as Partial<CursorPayload>;
    if (typeof updatedAt !== "string" || typeof id !== "string") return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
};

const encodeCursor = (value: CursorPayload) => Buffer.from(JSON.stringify(value), "utf-8").toString("base64url");

const resolveLimit = (value?: number) => {
  if (value == null || !Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(Math.trunc(value), 200));
};

const asArray = <TValue>(value: TValue | TValue[] | undefined, fallback?: TValue[]) => {
  if (Array.isArray(value)) return value;
  if (value !== undefined) return [value];
  return fallback ?? [];
};

const isWithinCooldown = (row: NotificationRow, now: string, cooldownMs: number) => {
  const updatedAt = Date.parse(row.updated_at);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(updatedAt) || !Number.isFinite(nowMs)) return false;
  return nowMs - updatedAt <= cooldownMs;
};

const buildListConditions = (input: ListInput) => {
  const conditions = [eq(notifications.project_id, input.project_id)];
  const statuses = asArray(input.status, ["open"]);
  const priorities = asArray(input.priority);

  if (statuses.length === 1) conditions.push(eq(notifications.status, statuses[0]));
  if (statuses.length > 1) conditions.push(inArray(notifications.status, statuses));
  if (priorities.length === 1) conditions.push(eq(notifications.priority, priorities[0]));
  if (priorities.length > 1) conditions.push(inArray(notifications.priority, priorities));
  if (input.source_extension_id) conditions.push(eq(notifications.source_extension_id, input.source_extension_id));
  if (input.resource_type) {
    conditions.push(sql`${notifications.target_json}->>'type' = ${input.resource_type}`);
  }
  if (input.resource_id) {
    conditions.push(sql`${notifications.target_json}->>'id' = ${input.resource_id}`);
  }
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor);
    if (cursor) {
      conditions.push(
        or(
          lt(notifications.updated_at, cursor.updatedAt),
          and(eq(notifications.updated_at, cursor.updatedAt), lt(notifications.id, cursor.id)),
        )!,
      );
    }
  }

  return conditions;
};

const initialStatus = (input: CreateInput) => input.status ?? (input.snoozed_until ? "snoozed" : "open");

const createNotificationRow = (input: CreateInput, timestamp: string): NotificationRow => {
  const status = initialStatus(input);

  return {
    id: crypto.randomUUID(),
    project_id: input.project_id,
    source: input.source,
    origin: input.origin,
    source_extension_id: input.source_extension_id ?? null,
    actor_type: input.actor_type ?? null,
    actor_id: input.actor_id ?? null,
    title: input.title,
    body: input.body ?? null,
    kind: input.kind,
    priority: input.priority ?? "normal",
    status,
    target_json: input.target_json ?? null,
    related_json: input.related_json ?? [],
    actions_json: input.actions_json ?? [],
    metadata_json: input.metadata_json ?? null,
    dedupe_key: input.dedupe_key ?? null,
    created_at: timestamp,
    updated_at: timestamp,
    read_at: status === "read" ? timestamp : null,
    resolved_at: terminalStatuses.includes(status) ? timestamp : null,
    snoozed_until: input.snoozed_until ?? null,
    expires_at: input.expires_at ?? null,
  };
};

export const createNotificationsDBService = (db: DbClient) => {
  const get = async (projectId: string, id: string) => {
    const [row] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.project_id, projectId), eq(notifications.id, id)));
    return row ?? null;
  };

  const findLiveByDedupeKey = async (projectId: string, dedupeKey: string) => {
    const [row] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.project_id, projectId),
          eq(notifications.dedupe_key, dedupeKey),
          inArray(notifications.status, liveStatuses),
        ),
      )
      .orderBy(desc(notifications.updated_at), desc(notifications.id))
      .limit(1);
    return row ?? null;
  };

  const findLatestTerminalByDedupeKey = async (projectId: string, dedupeKey: string) => {
    const [row] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.project_id, projectId),
          eq(notifications.dedupe_key, dedupeKey),
          inArray(notifications.status, terminalStatuses),
        ),
      )
      .orderBy(desc(notifications.updated_at), desc(notifications.id))
      .limit(1);
    return row ?? null;
  };

  const updateLiveDedupe = async (input: CreateInput, live: NotificationRow, timestamp: string) => {
    const nextStatus = live.status === "read" ? "open" : live.status;
    const [updated] = await db
      .update(notifications)
      .set({
        title: input.title,
        body: input.body ?? null,
        kind: input.kind,
        priority: input.priority ?? live.priority,
        status: nextStatus,
        target_json: input.target_json ?? null,
        related_json: input.related_json ?? [],
        actions_json: input.actions_json ?? [],
        metadata_json: input.metadata_json ?? null,
        snoozed_until: input.snoozed_until ?? live.snoozed_until,
        expires_at: input.expires_at ?? null,
        read_at: nextStatus === "open" ? null : live.read_at,
        updated_at: timestamp,
      })
      .where(eq(notifications.id, live.id))
      .returning();
    return updated;
  };

  const applyDedupe = async (input: CreateInput, timestamp: string) => {
    if (!input.dedupe_key) return null;

    const live = await findLiveByDedupeKey(input.project_id, input.dedupe_key);
    if (live) return updateLiveDedupe(input, live, timestamp);

    const terminal = await findLatestTerminalByDedupeKey(input.project_id, input.dedupe_key);
    const cooldownMs = input.terminalCooldownMs ?? defaultTerminalCooldownMs;
    if (terminal && isWithinCooldown(terminal, timestamp, cooldownMs)) return terminal;

    return null;
  };

  const create = async (input: CreateInput) => {
    const timestamp = nowTimestamp();
    const deduped = await applyDedupe(input, timestamp);
    if (deduped) return deduped;

    const row = createNotificationRow(input, timestamp);
    try {
      await db.insert(notifications).values(row);
    } catch (error) {
      const cause = (error as { cause?: { code?: string; constraint?: string } }).cause;
      if (cause?.code !== "23505" || cause.constraint !== "notifications_project_live_dedupe_unique") throw error;
      if (!input.dedupe_key) throw error;

      const racedLive = await findLiveByDedupeKey(input.project_id, input.dedupe_key);
      if (!racedLive) throw error;
      return updateLiveDedupe(input, racedLive, nowTimestamp());
    }
    return row;
  };

  const list = async (input: ListInput) => {
    const limit = resolveLimit(input.limit);
    const rows = await db
      .select()
      .from(notifications)
      .where(and(...buildListConditions(input)))
      .orderBy(desc(notifications.updated_at), desc(notifications.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    return { items, nextCursor: hasMore && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null };
  };

  const count = async (input: Omit<ListInput, "cursor" | "limit">) => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...buildListConditions(input)));
    return row?.count ?? 0;
  };

  const updateStatus = async (
    projectId: string,
    id: string,
    status: NotificationStatus,
    extra: Partial<NotificationRow> = {},
  ) => {
    const timestamp = nowTimestamp();
    const [updated] = await db
      .update(notifications)
      .set({
        status,
        updated_at: timestamp,
        read_at: status === "read" ? timestamp : extra.read_at,
        resolved_at: terminalStatuses.includes(status) ? timestamp : extra.resolved_at,
        ...extra,
      })
      .where(
        and(
          eq(notifications.project_id, projectId),
          eq(notifications.id, id),
          inArray(notifications.status, liveStatuses),
        ),
      )
      .returning();
    return updated ?? null;
  };

  const update = async (projectId: string, id: string, input: UpdateInput) => {
    const timestamp = nowTimestamp();
    const [updated] = await db
      .update(notifications)
      .set({ ...input, updated_at: timestamp })
      .where(and(eq(notifications.project_id, projectId), eq(notifications.id, id)))
      .returning();
    return updated ?? null;
  };

  const resolveByDedupeKey = async (projectId: string, dedupeKey: string, status: NotificationStatus = "done") => {
    const timestamp = nowTimestamp();
    return db
      .update(notifications)
      .set({ status, updated_at: timestamp, resolved_at: timestamp })
      .where(
        and(
          eq(notifications.project_id, projectId),
          eq(notifications.dedupe_key, dedupeKey),
          inArray(notifications.status, liveStatuses),
        ),
      )
      .returning();
  };

  const wakeDueSnoozed = async (nowIso = nowTimestamp()) =>
    db
      .update(notifications)
      .set({ status: "open", snoozed_until: null, updated_at: nowTimestamp() })
      .where(and(eq(notifications.status, "snoozed"), lte(notifications.snoozed_until, nowIso)))
      .returning();

  return {
    create,
    count,
    dismiss: (projectId: string, id: string) => updateStatus(projectId, id, "dismissed"),
    get,
    list,
    markDone: (projectId: string, id: string) => updateStatus(projectId, id, "done"),
    markRead: (projectId: string, id: string) => updateStatus(projectId, id, "read"),
    expire: (projectId: string, id: string) => updateStatus(projectId, id, "expired"),
    resolveByDedupeKey,
    snooze: (projectId: string, id: string, until: string) =>
      updateStatus(projectId, id, "snoozed", { snoozed_until: until }),
    update,
    wakeDueSnoozed,
  };
};
