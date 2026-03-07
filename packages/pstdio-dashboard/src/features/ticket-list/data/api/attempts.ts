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
  const response = await apiRequest<ApiCreateTicketAttemptResponse>(`/v1/tickets/${input.ticketId}/attempts`, {
    method: "POST",
    body: {
      agent: input.agent ?? null,
      branch: input.branch ?? null,
      repo_id: input.repoId ?? null,
      mode: input.mode ?? "worktree",
      model: input.model ?? null,
      prompt: input.prompt ?? null,
    },
  });

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
