import { apiClient } from "@/features/api-client";

export const listWorkspaces = async (projectId: string) => apiClient().workspaces.list(projectId);
