import { apiClient } from "@/features/api-client";

export const forkSession = (id: string) => apiClient().sessions.fork(id);
