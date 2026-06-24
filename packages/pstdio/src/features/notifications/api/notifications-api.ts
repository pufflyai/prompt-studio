import { apiClient } from "@/features/api-client";

export const listNotifications = async (
  projectId: string,
  query: Parameters<ReturnType<typeof apiClient>["notifications"]["list"]>[1],
) => apiClient().notifications.list(projectId, query);

export const showNotification = async (projectId: string, id: string) => apiClient().notifications.get(projectId, id);

export const sendNotification: ReturnType<typeof apiClient>["notifications"]["create"] = (input) =>
  apiClient().notifications.create(input);

export const readNotification = (projectId: string, id: string) => apiClient().notifications.markRead(projectId, id);
export const doneNotification = (projectId: string, id: string) => apiClient().notifications.done(projectId, id);
export const dismissNotification = (projectId: string, id: string) => apiClient().notifications.dismiss(projectId, id);
export const snoozeNotification = (projectId: string, id: string, until: string) =>
  apiClient().notifications.snooze(projectId, id, { until });
