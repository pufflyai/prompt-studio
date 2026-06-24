import type {
  NotificationActionItem,
  NotificationItem,
  NotificationKind,
  NotificationPriority,
  NotificationStatus,
} from "@pstdio/ui";
import type { Notification, NotificationAction } from "pstdio-api-contracts";
import { getCollection, type SyncedRow } from "@/lib/sync/collections";

type ApiNotification = Notification & { id: string };

export type NotificationInboxFilter = "open" | "snoozed" | "done" | "all";

const FILTER_STATUSES: Record<NotificationInboxFilter, NotificationStatus[]> = {
  open: ["open", "read"],
  snoozed: ["snoozed"],
  done: ["done", "dismissed", "expired"],
  all: ["open", "read", "snoozed", "done", "dismissed", "expired"],
};

const isApiNotification = (row: SyncedRow): row is ApiNotification =>
  typeof (row as ApiNotification).projectId === "string";

const toActionItem = (action: NotificationAction): NotificationActionItem => ({
  id: action.id,
  label: action.label,
  primary: action.primary,
  destructive: action.kind === "command" ? action.destructive : undefined,
  kind: action.kind,
});

const toItem = (row: ApiNotification): NotificationItem => ({
  id: row.id,
  title: row.title,
  body: row.body ?? null,
  kind: row.kind as NotificationKind,
  status: row.status as NotificationStatus,
  priority: row.priority as NotificationPriority,
  sourceLabel: row.sourceExtensionId ?? row.origin,
  resourceLabel: row.target?.label ?? row.target?.id ?? null,
  updatedAt: row.updatedAt,
  snoozedUntil: row.snoozedUntil ?? null,
  actions: (row.actions ?? []).map(toActionItem),
});

export const readNotificationItems = (
  projectId: string | undefined,
  filter: NotificationInboxFilter = "open",
): NotificationItem[] => {
  const rows = Array.from(getCollection("notifications").state.values()) as SyncedRow[];
  const statuses = FILTER_STATUSES[filter];
  return rows
    .filter(isApiNotification)
    .filter((row) => (projectId ? row.projectId === projectId : true))
    .filter((row) => statuses.includes(row.status as NotificationStatus))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map(toItem);
};

export const findNotificationByItemId = (id: string) => {
  const rows = Array.from(getCollection("notifications").state.values()) as SyncedRow[];
  return (rows.find((row) => row.id === id && isApiNotification(row)) as ApiNotification | undefined) ?? null;
};

export const findActionOnNotification = (notification: ApiNotification, actionId: string): NotificationAction | null =>
  notification.actions.find((a) => a.id === actionId) ?? null;
