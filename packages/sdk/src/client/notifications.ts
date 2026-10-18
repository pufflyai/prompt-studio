import type {
  CreateNotificationInput,
  ListNotificationsQuery,
  ListNotificationsResponse,
  Notification,
  NotificationStatus,
  Page,
  SetNotificationStatusInput,
  UpdateNotificationInput,
} from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type NotificationsClient = {
  query(projectId: string, input?: ListNotificationsQuery): Promise<Page<Notification>>;
  /** @deprecated Use query for the required nullable cursor contract. */
  list(projectId: string, query?: ListNotificationsQuery): Promise<ListNotificationsResponse>;
  count(
    projectId: string,
    query?: Pick<ListNotificationsQuery, "status" | "priority" | "sourceExtensionId">,
  ): Promise<{ count: number }>;
  get(projectId: string, id: string): Promise<Notification>;
  create(projectId: string, input: Omit<CreateNotificationInput, "projectId">): Promise<Notification>;
  /** @deprecated Pass projectId as the first argument. */
  create(input: CreateNotificationInput): Promise<Notification>;
  update(projectId: string, id: string, input: UpdateNotificationInput): Promise<Notification>;
  setStatus(projectId: string, id: string, input: SetNotificationStatusInput): Promise<Notification | null>;
  setStatusByKey(projectId: string, key: string, input: SetNotificationStatusInput): Promise<Notification[]>;
  /** @deprecated Use setStatus. */
  markRead(projectId: string, id: string): Promise<Notification>;
  /** @deprecated Use setStatus or setStatusByKey. */
  dismiss(projectId: string, id: string): Promise<Notification>;
  /** @deprecated Use setStatus or setStatusByKey. */
  markDone(projectId: string, id: string): Promise<Notification>;
  /** @deprecated Use setStatus or setStatusByKey. */
  snooze(projectId: string, id: string, until: string): Promise<Notification>;
  /** @deprecated Use setStatus or setStatusByKey. */
  resolveByDedupeKey(
    projectId: string,
    input: { dedupeKey: string; status?: Extract<NotificationStatus, "done" | "dismissed" | "expired"> },
  ): Promise<{ resolved: number; notifications: Notification[] }>;
};

const appendArrayOrValue = (params: URLSearchParams, key: string, value: string | string[] | undefined) => {
  if (value === undefined) return;
  params.set(key, Array.isArray(value) ? value.join(",") : value);
};

const buildQuery = (query: ListNotificationsQuery = {}) => {
  const params = new URLSearchParams();
  appendArrayOrValue(params, "status", query.status);
  appendArrayOrValue(params, "priority", query.priority);
  if (query.sourceExtensionId) params.set("sourceExtensionId", query.sourceExtensionId);
  if (query.resourceType) params.set("resourceType", query.resourceType);
  if (query.resourceId) params.set("resourceId", query.resourceId);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  const value = params.toString();
  return value ? `?${value}` : "";
};

const notificationPath = (projectId: string, suffix = "") =>
  `/v1/projects/${encodeURIComponent(projectId)}/notifications${suffix}`;

export const createNotificationsClient = (request: RequestFn): NotificationsClient => ({
  query: async (projectId, input) => {
    const page = await request<ListNotificationsResponse>(notificationPath(projectId, buildQuery(input)));
    return { ...page, nextCursor: page.nextCursor ?? null };
  },
  list: (projectId, query) => request(notificationPath(projectId, buildQuery(query))),
  count: (projectId, query) => request(notificationPath(projectId, `/count${buildQuery(query)}`)),
  get: (projectId, id) => request(notificationPath(projectId, `/${encodeURIComponent(id)}`)),
  create: (projectOrInput: string | CreateNotificationInput, input?: Omit<CreateNotificationInput, "projectId">) => {
    const { projectId, ...body } =
      typeof projectOrInput === "string" ? { ...input, projectId: projectOrInput } : projectOrInput;
    return request(notificationPath(projectId), { method: "POST", body });
  },
  update: (projectId, id, input) =>
    request(notificationPath(projectId, `/${encodeURIComponent(id)}`), { method: "PATCH", body: input }),
  setStatus: (projectId, id, input) =>
    request(notificationPath(projectId, `/${encodeURIComponent(id)}/status`), { method: "POST", body: input }),
  setStatusByKey: (projectId, key, input) =>
    request(notificationPath(projectId, "/status-by-key"), { method: "POST", body: { key, ...input } }),
  markRead: (projectId, id) =>
    request(notificationPath(projectId, `/${encodeURIComponent(id)}/read`), { method: "POST" }),
  dismiss: (projectId, id) =>
    request(notificationPath(projectId, `/${encodeURIComponent(id)}/dismiss`), { method: "POST" }),
  markDone: (projectId, id) =>
    request(notificationPath(projectId, `/${encodeURIComponent(id)}/done`), { method: "POST" }),
  snooze: (projectId, id, until) =>
    request(notificationPath(projectId, `/${encodeURIComponent(id)}/snooze`), { method: "POST", body: { until } }),
  resolveByDedupeKey: (projectId, input) =>
    request(notificationPath(projectId, "/resolve-by-dedupe-key"), { method: "POST", body: input }),
});
