import { apiClient } from "@/features/api-client";

export const startHarnessSession = async (input: {
  project_id: string;
  title: string;
  prompt?: string;
  template?: string;
  vars?: Record<string, string>;
  harness?: string;
  workspace_id?: string;
  model?: string;
  original_session_id?: string;
}) => apiClient().harnesses.startSession(input);
