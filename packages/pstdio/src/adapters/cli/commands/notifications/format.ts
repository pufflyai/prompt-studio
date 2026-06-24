import type { Notification, ResourceRef } from "@pstdio/sdk/api";

const pad = (value: string, width: number) => value.padEnd(width);

export const parseNotificationTarget = (value: string): ResourceRef => {
  const separator = value.indexOf(":");
  if (separator === -1) throw new Error(`Invalid target "${value}". Expected type:id.`);
  const type = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!type || !id) throw new Error(`Invalid target "${value}". Expected type:id.`);
  return { type, id, label: id };
};

export const parseSnoozeUntil = (value: string, now = new Date()) => {
  const relative = value.match(/^(\d+)(m|h|d)$/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const multiplier = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
    return new Date(now.getTime() + amount * multiplier).toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid snooze deadline "${value}".`);
  return parsed.toISOString();
};

export const formatNotificationsTable = (notifications: Notification[]) => {
  const header = { id: "ID", priority: "Priority", status: "Status", kind: "Kind", title: "Title" };
  const rows = notifications.map((notification) => ({
    id: notification.id,
    priority: notification.priority,
    status: notification.status,
    kind: notification.kind,
    title: notification.title,
  }));

  const widths = {
    id: Math.max(header.id.length, ...rows.map((row) => row.id.length)),
    priority: Math.max(header.priority.length, ...rows.map((row) => row.priority.length)),
    status: Math.max(header.status.length, ...rows.map((row) => row.status.length)),
    kind: Math.max(header.kind.length, ...rows.map((row) => row.kind.length)),
  };

  const line = (row: typeof header) =>
    `${pad(row.id, widths.id)}   ${pad(row.priority, widths.priority)}   ${pad(row.status, widths.status)}   ${pad(
      row.kind,
      widths.kind,
    )}   ${row.title}`;

  return [line(header), ...rows.map(line)].join("\n");
};

export const formatNotificationDetails = (notification: Notification) =>
  [
    `ID:       ${notification.id}`,
    `Title:    ${notification.title}`,
    `Kind:     ${notification.kind}`,
    `Priority: ${notification.priority}`,
    `Status:   ${notification.status}`,
    notification.body ? `Body:     ${notification.body}` : null,
    notification.target ? `Target:   ${notification.target.type}:${notification.target.id}` : null,
    notification.dedupeKey ? `Dedupe:   ${notification.dedupeKey}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
