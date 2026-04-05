import { apiClient } from "@/features/api-client";

export const listTags = async (projectId: string) => apiClient().tags.list(projectId);
