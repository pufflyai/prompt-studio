import type {
  CreateNotificationInput,
  Notification,
  NotificationAction,
  NotificationActorType,
  NotificationKind,
  NotificationOrigin,
  NotificationPriority,
  NotificationStatus,
} from "pstdio-api-contracts";
import type { JsonObject, NotificationRecord, ResourceRef } from "pstdio-db";
import type { NotificationsRouteDeps } from "./deps";

const RE_EMIT_RESET_FROM_READ = "open" as const;
const LIVE_STATUSES = ["open", "read", "snoozed"] as const;
const TERMINAL_STATUSES = ["done", "dismissed", "expired"] as const;

export const toNotification = (row: NotificationRecord): Notification => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  body: row.body,
  kind: row.kind as NotificationKind,
  status: row.status as NotificationStatus,
  priority: row.priority as NotificationPriority,
  source: row.source,
  origin: row.origin as NotificationOrigin,
  sourceExtensionId: row.source_extension_id,
  actorType: (row.actor_type ?? null) as NotificationActorType | null,
  actorId: row.actor_id,
  target: row.target_json,
  related: (row.related_json ?? []) as ResourceRef[],
  actions: (row.actions_json ?? []) as NotificationAction[],
  dedupeKey: row.dedupe_key,
  metadata: row.metadata_json,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  readAt: row.read_at,
  resolvedAt: row.resolved_at,
  snoozedUntil: row.snoozed_until,
  expiresAt: row.expires_at,
});

const emitSet = (deps: NotificationsRouteDeps, row: NotificationRecord) => {
  deps.eventBus.emit("notifications", "set", toNotification(row));
};

const recordActivity = async (
  deps: NotificationsRouteDeps,
  input: { row: NotificationRecord; eventType: string; summary: string; extra?: JsonObject },
) => {
  await deps.activityEventsService.create({
    projectId: input.row.project_id,
    resourceType: "notification",
    resourceId: input.row.id,
    sourceExtensionId: input.row.source_extension_id ?? null,
    eventType: input.eventType,
    actorType: (input.row.actor_type as "user" | "agent" | "system" | undefined) ?? "system",
    source: "api",
    summary: input.summary,
    payloadJson: {
      kind: input.row.kind,
      priority: input.row.priority,
      dedupeKey: input.row.dedupe_key,
      target: input.row.target_json,
      ...(input.extra ?? {}),
    },
  });
};

export type CreateOrUpsertInput = CreateNotificationInput & {
  source?: string;
  origin?: NotificationOrigin;
  sourceExtensionId?: string | null;
  actorType?: NotificationActorType | null;
  actorId?: string | null;
};

const baseFieldsFrom = (input: CreateOrUpsertInput) => ({
  title: input.title,
  body: input.body ?? null,
  kind: input.kind as string,
  priority: (input.priority ?? "normal") as string,
  target: input.target ?? null,
  related: input.related ?? [],
  actions: input.actions ?? [],
  metadata: input.metadata ?? null,
});

const reEmitExisting = async (
  deps: NotificationsRouteDeps,
  existing: NotificationRecord,
  input: CreateOrUpsertInput,
) => {
  const updated = await deps.notificationsService.update(input.projectId, existing.id, {
    ...baseFieldsFrom(input),
    status: existing.status === "read" ? RE_EMIT_RESET_FROM_READ : existing.status,
    expiresAt: input.expiresAt ?? null,
  });
  if (!updated) throw new Error(`Notification missing after upsert: ${existing.id}`);
  emitSet(deps, updated);
  await recordActivity(deps, {
    row: updated,
    eventType: "notification.updated",
    summary: `notification ${updated.id} re-emitted by dedupe key`,
  });
  return updated;
};

const createFresh = async (deps: NotificationsRouteDeps, input: CreateOrUpsertInput) => {
  const created = await deps.notificationsService.create({
    projectId: input.projectId,
    source: input.source ?? "api",
    origin: input.origin ?? "core",
    sourceExtensionId: input.sourceExtensionId ?? null,
    actorType: input.actorType ?? null,
    actorId: input.actorId ?? null,
    ...baseFieldsFrom(input),
    dedupeKey: input.dedupeKey ?? null,
    snoozedUntil: input.snoozedUntil ?? null,
    expiresAt: input.expiresAt ?? null,
  });
  emitSet(deps, created);
  await recordActivity(deps, {
    row: created,
    eventType: "notification.created",
    summary: `${created.source_extension_id ?? "core"} created notification: ${created.title}`,
  });
  return created;
};

export const upsertNotification = async (deps: NotificationsRouteDeps, input: CreateOrUpsertInput) => {
  if (input.dedupeKey) {
    const existing = await deps.notificationsService.findLiveByDedupeKey(input.projectId, input.dedupeKey);
    if (existing) return reEmitExisting(deps, existing, input);
  }
  return createFresh(deps, input);
};

const nowIso = () => new Date().toISOString();

const isLiveStatus = (status: NotificationStatus) => (LIVE_STATUSES as readonly string[]).includes(status);

const isTerminalStatus = (status: string) => (TERMINAL_STATUSES as readonly string[]).includes(status);

export const transitionStatus = async (
  deps: NotificationsRouteDeps,
  input: { projectId: string; id: string; status: NotificationStatus; snoozedUntil?: string | null },
) => {
  const existing = await deps.notificationsService.findById(input.projectId, input.id);
  if (!existing) return null;
  if (isTerminalStatus(existing.status) && isLiveStatus(input.status)) return existing;

  const patch: Parameters<typeof deps.notificationsService.update>[2] = { status: input.status };
  if (input.status === "read") patch.readAt = nowIso();
  if (input.status === "done" || input.status === "dismissed" || input.status === "expired") {
    patch.resolvedAt = nowIso();
  }
  if (input.status === "snoozed") patch.snoozedUntil = input.snoozedUntil ?? null;
  if (input.status === "open") {
    patch.snoozedUntil = null;
  }
  const updated = await deps.notificationsService.update(input.projectId, input.id, patch);
  if (!updated) return null;
  emitSet(deps, updated);
  await recordActivity(deps, {
    row: updated,
    eventType: `notification.${input.status}`,
    summary: `notification ${updated.id} → ${input.status}`,
    extra: input.snoozedUntil ? { snoozedUntil: input.snoozedUntil } : undefined,
  });
  return updated;
};

export const resolveByDedupeKey = async (
  deps: NotificationsRouteDeps,
  input: { projectId: string; dedupeKey: string; status?: "done" | "dismissed" | "expired" },
) => {
  const existing = await deps.notificationsService.findLiveByDedupeKey(input.projectId, input.dedupeKey);
  if (!existing) return null;
  return transitionStatus(deps, {
    projectId: input.projectId,
    id: existing.id,
    status: input.status ?? "done",
  });
};

export const wakeDueSnoozed = async (deps: NotificationsRouteDeps) => {
  const due = await deps.notificationsService.listDueSnoozed(nowIso());
  for (const row of due) {
    await transitionStatus(deps, { projectId: row.project_id, id: row.id, status: "open" });
  }
  return due.length;
};
