import { apiClient } from "@/features/api-client";

export const listPlugins = async (projectId: string) => apiClient().projects.listPlugins(projectId);
