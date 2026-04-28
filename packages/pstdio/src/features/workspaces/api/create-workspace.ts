import { apiClient } from "@/features/api-client";

export const createWorkspace = async (input: {
  project_id: string;
  name?: string;
  anchors?: {
    type: string;
    id: string;
    projectId?: string;
    label?: string;
    extensionId?: string;
    role?: "primary" | "context" | "source" | "result";
    metadata?: Record<string, unknown>;
  }[];
  branch?: string;
  worktree_path?: string;
}) => apiClient().workspaces.create(input);
