import { apiClient } from "@/features/api-client";

export const listTicketTags = async (projectId: string) => apiClient().tags.list(projectId);
