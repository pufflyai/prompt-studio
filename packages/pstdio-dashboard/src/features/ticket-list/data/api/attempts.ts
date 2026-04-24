import { apiRequest } from "@/lib/api";
import type {
  ApiCreateTicketAttemptResponse,
  ApiTicketAttemptDiff,
  CreateTicketAttemptInput,
  CreateTicketAttemptResult,
} from "./types";

export const createTicketAttempt = async (input: CreateTicketAttemptInput) => {
  const body: Record<string, unknown> = {
    mode: input.mode ?? "worktree",
  };

  if (input.agent) {
    body.agent = input.agent;
  }
  if (input.branch) {
    body.branch = input.branch;
  }
  if (input.repoId) {
    body.repo_id = input.repoId;
  }
  if (input.model) {
    body.model = input.model;
  }
  if (input.prompt !== undefined) {
    body.prompt = input.prompt;
  }
  if (input.startSession !== undefined) {
    body.start_session = input.startSession;
  }

  const response = await apiRequest<ApiCreateTicketAttemptResponse>(`/v1/tickets/${input.ticketId}/attempts`, {
    method: "POST",
    body,
  });

  return {
    ticketId: response.ticket.id,
    sessionId: response.session?.id ?? null,
    workspaceId: response.workspace.id,
    workspaceShorthand: response.workspace.workspace_shorthand,
  } satisfies CreateTicketAttemptResult;
};

export type DiffMode = "current" | "fork_point";

export const ATTEMPT_DIFF_MODE = "fork_point" satisfies DiffMode;

export const getTicketAttemptDiff = async (workspaceId: string, mode?: DiffMode) => {
  const params = mode ? `?mode=${mode}` : "";
  return apiRequest<ApiTicketAttemptDiff>(`/v1/workspaces/${workspaceId}/diff${params}`);
};

interface DiffSummary {
  workspace_id: string;
  additions: number;
  deletions: number;
  file_count: number;
}

export const getTicketAttemptDiffSummary = async (workspaceId: string) => {
  return apiRequest<DiffSummary>(`/v1/workspaces/${workspaceId}/diff-summary`);
};
