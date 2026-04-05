import { apiClient } from "@/features/api-client";

export const listTemplates = async (projectId: string) => apiClient().templates.list(projectId);
