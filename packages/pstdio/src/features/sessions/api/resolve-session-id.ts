import { apiClient } from "@/features/api-client";

export const resolveSessionId = async (input: { harness: string; agent_session_id: string; cwd?: string }) =>
  apiClient().sessions.resolveSessionId(input);
