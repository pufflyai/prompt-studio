import { apiClient } from "@/features/api-client";

export const createSession = async (input: {
  project_id: string;
  title: string;
  prompt?: string;
  template?: string;
  vars?: Record<string, string>;
  agent?: string;
  workspace_id?: string;
  model?: string;
  original_session_id?: string;
}) => apiClient().sessions.create(input);
