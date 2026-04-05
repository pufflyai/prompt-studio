import { apiClient } from "@/features/api-client";

export const listStatuses = async (projectId: string) => apiClient().statuses.list(projectId);
