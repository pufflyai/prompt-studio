import { apiClient } from "@/features/api-client";

export const resolveSessionId = async (input: { agent: string; agent_session_id: string; cwd?: string }) =>
  apiClient().sessions.resolveSessionId(input);
