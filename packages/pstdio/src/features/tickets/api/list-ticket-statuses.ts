import { apiClient } from "@/features/api-client";

export const listTicketStatuses = async (projectId: string) => apiClient().statuses.list(projectId);
