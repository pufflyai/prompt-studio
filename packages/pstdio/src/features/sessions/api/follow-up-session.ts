import { apiClient } from "@/features/api-client";

export const followUpSession = async (
  sessionId: string,
  input: {
    prompt?: string;
    template?: string;
    vars?: Record<string, string>;
    agent?: string;
    model?: string;
    summary_from_session_id?: string;
    summary_format?: "brief" | "detailed";
    summary_role?: "assistant" | "all";
  },
) => apiClient().sessions.followUp(sessionId, input);
