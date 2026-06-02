import { apiClient } from "@/features/api-client";

export const createWorkspace = async (input: { project_id: string; repo_id?: string; base?: string }) =>
  apiClient().workspaces.create(input);
