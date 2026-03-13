import { apiRequest } from "@/lib/api";
import type {
  ApiCreateTicketAttemptResponse,
  ApiTicketAttemptDiff,
  CreateTicketAttemptInput,
  CreateTicketAttemptResult,
  MergeTicketAttemptResult,
  SwitchBackTicketAttemptResult,
  SwitchToTicketAttemptResult,
  TicketAttemptSwapStatus,
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

  const response = await apiRequest<ApiCreateTicketAttemptResponse>(`/v1/tickets/${input.ticketId}/attempts`, {
    method: "POST",
    body,
  });

  if (!response.session) {
    throw new Error("Ticket attempt did not start a session.");
  }

  return {
    ticketId: response.ticket.id,
    sessionId: response.session.id,
    workspaceId: response.workspace.id,
    workspaceShorthand: response.workspace.workspace_shorthand,
  } satisfies CreateTicketAttemptResult;
};

export const getTicketAttemptDiff = async (workspaceId: string) => {
  return apiRequest<ApiTicketAttemptDiff>(`/v1/ticket-attempts/${workspaceId}/diff`);
};

export const mergeTicketAttempt = async (workspaceId: string) => {
  return apiRequest<MergeTicketAttemptResult>(`/v1/ticket-attempts/${workspaceId}/merge`, {
    method: "POST",
  });
};

export const switchToTicketAttempt = async (workspaceId: string) => {
  return apiRequest<SwitchToTicketAttemptResult>(`/v1/ticket-attempts/${workspaceId}/switch-to`, {
    method: "POST",
  });
};

export const switchBackTicketAttempt = async (workspaceId: string) => {
  return apiRequest<SwitchBackTicketAttemptResult>(`/v1/ticket-attempts/${workspaceId}/switch-back`, {
    method: "POST",
  });
};

export const getTicketAttemptSwapStatus = async (workspaceId: string) => {
  return apiRequest<TicketAttemptSwapStatus>(`/v1/ticket-attempts/${workspaceId}/swap-status`);
};
