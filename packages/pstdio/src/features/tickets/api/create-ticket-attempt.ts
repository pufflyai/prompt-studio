import { apiClient } from "@/features/api-client";

export const createTicketAttempt = async (
  ticketId: string,
  input: {
    agent?: string;
    branch?: string;
    repo_id?: string;
    repo_path?: string;
    mode?: "worktree" | "current_branch";
    model?: string;
    prompt?: string | null;
    base?: string;
    start_session?: boolean;
  },
) => apiClient().tickets.createAttempt(ticketId, input);
