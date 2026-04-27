import { apiClient } from "@/features/api-client";

export const sendHarnessSession = async (
  sessionId: string,
  input: {
    prompt?: string;
    template?: string;
    vars?: Record<string, string>;
    harness?: string;
    model?: string;
    summary_from_session_id?: string;
    summary_format?: "brief" | "detailed";
    summary_role?: "assistant" | "all";
  },
) => apiClient().harnesses.send(sessionId, input);
