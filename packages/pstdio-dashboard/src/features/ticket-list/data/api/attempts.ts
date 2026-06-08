import { apiRequest } from "@/lib/api";
import type { ApiTicketAttemptDiff, DiffMode } from "@/shared/workspace-diff-api";
import { executePlannerCommand } from "./planner";
import type { CreateTicketAttemptInput, CreateTicketAttemptResult } from "./types";

interface PlannerRunAttemptResponse {
  ticket: { id: string };
  workspace: { id: string; workspace_shorthand?: string | null };
  session: { id: string } | null;
}

export const createTicketAttempt = async (input: CreateTicketAttemptInput) => {
  const params: Record<string, unknown> = {
    ticket: input.ticketId,
    mode: input.mode ?? "worktree",
  };

  if (input.agent) {
    params.agent = { harnessId: input.agent, ...(input.model ? { model: input.model } : {}) };
  }
  if (input.repoId || input.branch) {
    params.repo = {
      ...(input.repoId ? { repoId: input.repoId } : {}),
      ...(input.branch ? { branch: input.branch } : {}),
    };
  }
  if (input.startSession !== undefined) {
    params.startSession = input.startSession;
  }

  const response = await executePlannerCommand<PlannerRunAttemptResponse>(input.projectId, "run-attempt", params);

  return {
    ticketId: response.ticket.id,
    sessionId: response.session?.id ?? null,
    workspaceId: response.workspace.id,
    workspaceShorthand: response.workspace.workspace_shorthand ?? response.workspace.id,
  } satisfies CreateTicketAttemptResult;
};

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

export const getTicketAttemptDiffSummary = async (workspaceId: string, mode?: DiffMode) => {
  const params = mode ? `?mode=${mode}` : "";
  return apiRequest<DiffSummary>(`/v1/workspaces/${workspaceId}/diff-summary${params}`);
};
