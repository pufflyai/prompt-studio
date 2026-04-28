import { apiClient } from "@/features/api-client";

export const listTemplates = async (projectId: string, filters?: { type?: string }) =>
  apiClient().templates.list(projectId, filters);
