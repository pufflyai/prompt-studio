import { apiClient } from "@/features/api-client";

export const listAttemptStatuses = async (projectId: string) => apiClient().statuses.listAttemptStatuses(projectId);
