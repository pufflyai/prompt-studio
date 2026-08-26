import { apiClient } from "@/features/api-client";

export const createWorkspace = async (input: {
  project_id: string;
  repo_id?: string;
  base?: string;
  provider_id?: string;
  params?: Record<string, unknown>;
}) => apiClient().workspaces.create(input);
