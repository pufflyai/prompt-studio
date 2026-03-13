import type { Workspace } from "@/features/workspaces/types";

type CreateTicketAttemptInput = {
  agent?: string;
  branch?: string;
  repo_id?: string;
  repo_path?: string;
  mode?: "worktree" | "current_branch";
  model?: string;
  prompt?: string | null;
  base?: string;
  start_session?: boolean;
};

type TicketAttemptResponse = {
  mode: "worktree" | "current_branch";
  ticket: {
    id: string;
    shorthand: string;
    display_title: string | null;
  };
  workspace: Workspace;
  session: {
    id: string;
    workspace_id: string;
    title: string;
    created_at: string;
    updated_at: string;
  } | null;
};

export const createTicketAttempt = async (baseUrl: string, ticketId: string, input: CreateTicketAttemptInput) => {
  const res = await fetch(`${baseUrl}/v1/tickets/${encodeURIComponent(ticketId)}/attempts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error(`Failed to create ticket attempt: ${res.status}`);

  return (await res.json()) as TicketAttemptResponse;
};
