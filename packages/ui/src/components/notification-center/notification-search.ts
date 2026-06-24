import type { NotificationActionItem, NotificationItem } from "./notification-types";

const haystack = (item: NotificationItem) =>
  [
    item.title,
    item.body ?? "",
    item.kind,
    item.sourceLabel ?? "",
    item.resourceLabel ?? "",
    ...item.actions.map((a: NotificationActionItem) => a.label),
  ]
    .join(" • ")
    .toLowerCase();

export const filterNotifications = (items: NotificationItem[], query: string) => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) => haystack(item).includes(trimmed));
};
