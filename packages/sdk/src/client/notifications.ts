import type {
  CreateNotificationInput,
  ListNotificationsQuery,
  ListNotificationsResponse,
  Notification,
  NotificationCountResponse,
  ResolveByDedupeKeyInput,
  SnoozeNotificationInput,
  UpdateNotificationInput,
} from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type NotificationsClient = {
  list(projectId: string, query?: ListNotificationsQuery): Promise<ListNotificationsResponse>;
  count(
    projectId: string,
    query?: Pick<ListNotificationsQuery, "status" | "priority" | "sourceExtensionId">,
  ): Promise<NotificationCountResponse>;
  get(projectId: string, id: string): Promise<Notification>;
  create(input: CreateNotificationInput): Promise<Notification>;
  update(projectId: string, id: string, input: UpdateNotificationInput): Promise<Notification>;
  markRead(projectId: string, id: string): Promise<Notification>;
  dismiss(projectId: string, id: string): Promise<Notification>;
  done(projectId: string, id: string): Promise<Notification>;
  snooze(projectId: string, id: string, input: SnoozeNotificationInput): Promise<Notification>;
  resolveByDedupeKey(input: { projectId: string } & ResolveByDedupeKeyInput): Promise<Notification | null>;
};

const appendList = (params: URLSearchParams, key: string, value: string | string[] | undefined) => {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    if (value.length === 0) return;
    params.append(key, value.join(","));
    return;
  }
  params.append(key, value);
};

const buildListQuery = (query?: ListNotificationsQuery) => {
  if (!query) return "";
  const params = new URLSearchParams();
  appendList(params, "status", query.status);
  appendList(params, "priority", query.priority);
  if (query.sourceExtensionId) params.append("sourceExtensionId", query.sourceExtensionId);
  if (query.resourceType) params.append("resourceType", query.resourceType);
  if (query.resourceId) params.append("resourceId", query.resourceId);
  if (query.cursor) params.append("cursor", query.cursor);
  if (query.limit !== undefined) params.append("limit", String(query.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const createNotificationsClient = (request: RequestFn): NotificationsClient => ({
  list: (projectId, query) => request(`/v1/projects/${projectId}/notifications${buildListQuery(query)}`),
  count: (projectId, query) => request(`/v1/projects/${projectId}/notifications/count${buildListQuery(query)}`),
  get: (projectId, id) => request(`/v1/projects/${projectId}/notifications/${id}`),
  create: ({ projectId, ...body }) => request(`/v1/projects/${projectId}/notifications`, { method: "POST", body }),
  update: (projectId, id, input) =>
    request(`/v1/projects/${projectId}/notifications/${id}`, { method: "PATCH", body: input }),
  markRead: (projectId, id) => request(`/v1/projects/${projectId}/notifications/${id}/read`, { method: "POST" }),
  dismiss: (projectId, id) => request(`/v1/projects/${projectId}/notifications/${id}/dismiss`, { method: "POST" }),
  done: (projectId, id) => request(`/v1/projects/${projectId}/notifications/${id}/done`, { method: "POST" }),
  snooze: (projectId, id, input) =>
    request(`/v1/projects/${projectId}/notifications/${id}/snooze`, { method: "POST", body: input }),
  resolveByDedupeKey: ({ projectId, ...body }) =>
    request(`/v1/projects/${projectId}/notifications/resolve-by-dedupe-key`, { method: "POST", body }),
});
