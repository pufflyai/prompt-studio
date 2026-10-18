import { createClient, type NotificationsClient } from "@pstdio/sdk/client";
import { resolveApiUrl } from "@/features/api-url";

export const createNotificationsApi = (baseUrl = resolveApiUrl()) =>
  createClient({ baseUrl }).notifications satisfies NotificationsClient;
