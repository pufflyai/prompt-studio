import { apiClient } from "@/features/api-client";

export const forkSession = (id: string, messageId?: string) => apiClient().sessions.fork(id, { messageId });
