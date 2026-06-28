import type {
  CommandSource,
  CreateNotificationInput,
  JsonObject,
  ListNotificationsQuery,
  Notification,
  NotificationActorType,
  NotificationOrigin,
  NotificationStatus,
  ResourceRef,
  UpdateNotificationInput,
} from "pstdio-api-contracts";
import type { createActivityEventsDBService, createNotificationsDBService, notifications } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

type NotificationRow = typeof notifications.$inferSelect;
type NotificationsDb = ReturnType<typeof createNotificationsDBService>;

type CreateNotificationServiceInput = CreateNotificationInput & {
  source?: CommandSource;
  origin?: NotificationOrigin;
  sourceExtensionId?: string | null;
  actorType?: NotificationActorType | null;
  actorId?: string | null;
};

type NotificationServiceDeps = {
  notificationsDb: NotificationsDb;
  activityEventsService: ReturnType<typeof createActivityEventsDBService>;
  eventBus: EventBus;
};

const isResourceRefArray = (value: unknown): value is ResourceRef[] => Array.isArray(value);

const toNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  body: row.body,
  kind: row.kind as Notification["kind"],
  status: row.status as NotificationStatus,
  priority: row.priority as Notification["priority"],
  source: row.source as CommandSource,
  origin: row.origin as NotificationOrigin,
  sourceExtensionId: row.source_extension_id,
  actorType: row.actor_type as NotificationActorType | null,
  actorId: row.actor_id,
  target: (row.target_json as ResourceRef | null) ?? null,
  related: isResourceRefArray(row.related_json) ? row.related_json : [],
  actions: row.actions_json as Notification["actions"],
  dedupeKey: row.dedupe_key,
  metadata: row.metadata_json as JsonObject | null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  readAt: row.read_at,
  resolvedAt: row.resolved_at,
  snoozedUntil: row.snoozed_until,
  expiresAt: row.expires_at,
});

const activitySourceFor = (source: string) => {
  if (source === "dashboard" || source === "command-panel" || source === "cli") return "ui";
  if (source === "event" || source === "automation") return "hook";
  if (source === "agent") return "agent";
  if (source === "schedule") return "system";
  return "api";
};

const actorTypeFor = (value: string | null) => {
  if (value === "user" || value === "agent" || value === "system") return value;
  return "system";
};

const emitActivity = async (
  deps: NotificationServiceDeps,
  row: NotificationRow,
  eventType: string,
  summary: string,
) => {
  await deps.activityEventsService.create({
    projectId: row.project_id,
    resourceType: "notification",
    resourceId: row.id,
    sourceExtensionId: row.source_extension_id,
    eventType,
    actorType: actorTypeFor(row.actor_type),
    actorId: row.actor_id ?? undefined,
    source: activitySourceFor(row.source),
    summary,
    payloadJson: {
      notificationId: row.id,
      kind: row.kind,
      priority: row.priority,
      dedupeKey: row.dedupe_key,
      target: row.target_json,
    },
  });
};

const emitUpdate = async (deps: NotificationServiceDeps, row: NotificationRow, eventType: string, summary: string) => {
  deps.eventBus.emit("notifications", "set", row);
  await emitActivity(deps, row, eventType, summary);
};

const parseStatuses = (value: ListNotificationsQuery["status"]) => value;

export const createNotificationService = (deps: NotificationServiceDeps) => {
  const create = async (input: CreateNotificationServiceInput) => {
    const row = await deps.notificationsDb.create({
      project_id: input.projectId,
      source: input.source ?? "api",
      origin: input.origin ?? "core",
      source_extension_id: input.sourceExtensionId ?? null,
      actor_type: input.actorType ?? "system",
      actor_id: input.actorId ?? null,
      title: input.title,
      body: input.body ?? null,
      kind: input.kind,
      priority: input.priority,
      target_json: (input.target as Record<string, unknown> | undefined) ?? null,
      related_json: input.related ?? [],
      actions_json: input.actions ?? [],
      metadata_json: (input.metadata as Record<string, unknown> | undefined) ?? null,
      dedupe_key: input.dedupeKey ?? null,
      snoozed_until: input.snoozedUntil ?? null,
      expires_at: input.expiresAt ?? null,
    });
    await emitUpdate(deps, row, "notification.created", `notification created: ${row.title}`);
    return toNotification(row);
  };

  const list = async (projectId: string, query: ListNotificationsQuery = {}) => {
    const result = await deps.notificationsDb.list({
      project_id: projectId,
      status: parseStatuses(query.status),
      priority: query.priority,
      source_extension_id: query.sourceExtensionId,
      resource_type: query.resourceType,
      resource_id: query.resourceId,
      cursor: query.cursor,
      limit: query.limit,
    });
    return { items: result.items.map(toNotification), nextCursor: result.nextCursor };
  };

  const count = async (
    projectId: string,
    query: Pick<ListNotificationsQuery, "status" | "priority" | "sourceExtensionId"> = {},
  ) => ({
    count: await deps.notificationsDb.count({
      project_id: projectId,
      status: query.status,
      priority: query.priority,
      source_extension_id: query.sourceExtensionId,
    }),
  });

  const update = async (projectId: string, id: string, input: UpdateNotificationInput) => {
    const row = await deps.notificationsDb.update(projectId, id, {
      priority: input.priority,
      snoozed_until: input.snoozedUntil,
      metadata_json: input.metadata,
    });
    if (!row) return null;
    await emitUpdate(deps, row, "notification.updated", `notification ${row.id} updated`);
    return toNotification(row);
  };

  const transition = async (projectId: string, id: string, status: "read" | "done" | "dismissed" | "expired") => {
    const row =
      status === "read"
        ? await deps.notificationsDb.markRead(projectId, id)
        : status === "done"
          ? await deps.notificationsDb.markDone(projectId, id)
          : status === "dismissed"
            ? await deps.notificationsDb.dismiss(projectId, id)
            : await deps.notificationsDb.expire(projectId, id);
    if (!row) return null;
    await emitUpdate(deps, row, `notification.${status}`, `notification ${row.id} ${status}`);
    return toNotification(row);
  };

  const snooze = async (projectId: string, id: string, until: string) => {
    const row = await deps.notificationsDb.snooze(projectId, id, until);
    if (!row) return null;
    await emitUpdate(deps, row, "notification.snoozed", `notification ${row.id} snoozed until ${until}`);
    return toNotification(row);
  };

  const resolveByDedupeKey = async (
    projectId: string,
    dedupeKey: string,
    status: Extract<NotificationStatus, "done" | "dismissed" | "expired"> = "done",
  ) => {
    const rows = await deps.notificationsDb.resolveByDedupeKey(projectId, dedupeKey, status);
    for (const row of rows) {
      await emitUpdate(deps, row, `notification.${status}`, `notification ${row.id} resolved (${status})`);
    }
    return { resolved: rows.length, notifications: rows.map(toNotification) };
  };

  const wakeDueSnoozed = async (nowIso?: string) => {
    const rows = await deps.notificationsDb.wakeDueSnoozed(nowIso);
    for (const row of rows) {
      await emitUpdate(deps, row, "notification.updated", `notification ${row.id} woke from snooze`);
    }
    return rows.map(toNotification);
  };

  return {
    count,
    create,
    get: async (projectId: string, id: string) => {
      const row = await deps.notificationsDb.get(projectId, id);
      return row ? toNotification(row) : null;
    },
    list,
    resolveByDedupeKey,
    snooze,
    transition,
    update,
    wakeDueSnoozed,
  };
};
