import type { ListNotificationsQuery, NotificationPriority, NotificationStatus } from "pstdio-api-contracts";

const splitCsv = <TValue extends string>(value: string | undefined) => {
  if (!value) return undefined;
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) as TValue[];
  if (entries.length === 0) return undefined;
  return entries.length === 1 ? entries[0] : entries;
};

export const parseListNotificationsQuery = (query: {
  status?: string;
  priority?: string;
  sourceExtensionId?: string;
  resourceType?: string;
  resourceId?: string;
  cursor?: string;
  limit?: number;
}): ListNotificationsQuery => ({
  status: splitCsv<NotificationStatus>(query.status),
  priority: splitCsv<NotificationPriority>(query.priority),
  sourceExtensionId: query.sourceExtensionId,
  resourceType: query.resourceType,
  resourceId: query.resourceId,
  cursor: query.cursor,
  limit: query.limit,
});
