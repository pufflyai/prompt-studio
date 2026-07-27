import { standardResourceIcons, type ResourceRef as WorkbenchResourceRef } from "@pstdio/workbench/core";
import type { ResourceRef as ExtensionResourceRef, Notification, NotificationAction } from "pstdio-api-contracts";
import { getCollection, type SyncedRow } from "@/lib/sync/collections";
import { createDashboardResource } from "@/shared/app/resources";

const pendingStatuses = new Set(["open", "read"]);
const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 } as const;

const stringValue = (value: unknown) => (typeof value === "string" ? value : undefined);
const arrayValue = <T>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []);
const objectValue = <T extends object>(value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as T) : undefined;

const readRows = () => Array.from(getCollection("notifications").state.values()) as SyncedRow[];

const toNotification = (row: SyncedRow): Notification => ({
  id: row.id,
  projectId: stringValue(row.project_id) ?? "",
  title: stringValue(row.title) ?? "Notification",
  body: stringValue(row.body) ?? null,
  kind: (stringValue(row.kind) ?? "info") as Notification["kind"],
  priority: (stringValue(row.priority) ?? "normal") as Notification["priority"],
  status: (stringValue(row.status) ?? "open") as Notification["status"],
  source: (stringValue(row.source) ?? "api") as Notification["source"],
  origin: (stringValue(row.origin) ?? "core") as Notification["origin"],
  sourceExtensionId: stringValue(row.source_extension_id) ?? null,
  actorType: (stringValue(row.actor_type) as Notification["actorType"]) ?? null,
  actorId: stringValue(row.actor_id) ?? null,
  target: objectValue<ExtensionResourceRef>(row.target_json) ?? null,
  related: arrayValue<ExtensionResourceRef>(row.related_json),
  actions: arrayValue<NotificationAction>(row.actions_json),
  dedupeKey: stringValue(row.dedupe_key) ?? null,
  metadata: objectValue<NonNullable<Notification["metadata"]>>(row.metadata_json) ?? null,
  createdAt: stringValue(row.created_at) ?? "",
  updatedAt: stringValue(row.updated_at) ?? "",
  readAt: stringValue(row.read_at) ?? null,
  resolvedAt: stringValue(row.resolved_at) ?? null,
  snoozedUntil: stringValue(row.snoozed_until) ?? null,
  expiresAt: stringValue(row.expires_at) ?? null,
});

const byPriorityThenUpdated = (left: Notification, right: Notification) => {
  const priority = priorityOrder[left.priority] - priorityOrder[right.priority];
  if (priority !== 0) return priority;
  return right.updatedAt.localeCompare(left.updatedAt);
};

export const createDashboardNotifications = (projectId: string | undefined) =>
  readRows()
    .map(toNotification)
    .filter((notification) => notification.projectId === projectId && pendingStatuses.has(notification.status))
    .sort(byPriorityThenUpdated);

export const countPendingNotifications = (projectId: string | undefined) =>
  createDashboardNotifications(projectId).length;

export const toWorkbenchResource = (
  resource: ExtensionResourceRef,
  projectId: string | undefined,
): WorkbenchResourceRef =>
  createDashboardResource(
    resource.type,
    resource.id,
    resource.label ?? resource.id,
    resource.type === "workspace" ? standardResourceIcons.workspace : standardResourceIcons.kanbanRenderer,
    resource.projectId ?? projectId,
    resource.metadata,
  );
