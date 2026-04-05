import { apiClient } from "@/features/api-client";

export const createWorkspace = async (input: {
  project_id: string;
  ticket_id: string;
  ticket_shorthand: string;
  branch?: string;
  worktree_path?: string;
}) => apiClient().workspaces.create(input);
