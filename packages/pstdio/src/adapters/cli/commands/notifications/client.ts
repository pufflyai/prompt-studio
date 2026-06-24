import type {
  CreateNotificationInput,
  ListNotificationsQuery,
  ListNotificationsResponse,
  Notification,
  NotificationStatus,
  UpdateNotificationInput,
} from "@pstdio/sdk/api";
import { createClient } from "@pstdio/sdk/client";
import { API_URL } from "@/features/api-url";

type NotificationsApi = {
  list(projectId: string, query?: ListNotificationsQuery): Promise<ListNotificationsResponse>;
  get(projectId: string, id: string): Promise<Notification>;
  create(input: CreateNotificationInput): Promise<Notification>;
  update(projectId: string, id: string, input: UpdateNotificationInput): Promise<Notification>;
  markRead(projectId: string, id: string): Promise<Notification>;
  dismiss(projectId: string, id: string): Promise<Notification>;
  markDone(projectId: string, id: string): Promise<Notification>;
  snooze(projectId: string, id: string, until: string): Promise<Notification>;
  resolveByDedupeKey(
    projectId: string,
    input: { dedupeKey: string; status?: Extract<NotificationStatus, "done" | "dismissed" | "expired"> },
  ): Promise<{ resolved: number; notifications: Notification[] }>;
};

export const createNotificationsApi = (baseUrl = API_URL) =>
  (createClient({ baseUrl }) as unknown as { notifications: NotificationsApi }).notifications;
