import { apiRequest } from "@/lib/api";
import { listPlannerCollection, readPlannerTicketContent } from "./planner";
import type {
  ApiCreateTicketAttemptResponse,
  ApiTicketAttemptDiff,
  CreateTicketAttemptInput,
  CreateTicketAttemptResult,
} from "./types";

const findPlannerTicketRow = async (projectId: string, ticketId: string) => {
  const rows = await listPlannerCollection(projectId, "tickets");
  return rows.find((row) => {
    const value = row.value_json as { id?: unknown; shorthand?: unknown };
    return row.item_id === ticketId || value.id === ticketId || value.shorthand === ticketId;
  });
};

const ticketValue = (row: Awaited<ReturnType<typeof findPlannerTicketRow>>) =>
  row?.value_json && typeof row.value_json === "object" ? (row.value_json as Record<string, unknown>) : {};

export const createTicketAttempt = async (projectId: string, input: CreateTicketAttemptInput) => {
  const ticketRow = await findPlannerTicketRow(projectId, input.ticketId);
  if (!ticketRow) {
    throw new Error(`Ticket not found: ${input.ticketId}`);
  }
  const ticket = ticketValue(ticketRow);
  const ticketId = typeof ticket.id === "string" ? ticket.id : ticketRow.item_id;
  const shorthand = typeof ticket.shorthand === "string" ? ticket.shorthand : ticketId;
  const title = typeof ticket.displayTitle === "string" && ticket.displayTitle ? ticket.displayTitle : shorthand;

  const workspace = await apiRequest<ApiCreateTicketAttemptResponse["workspace"]>("/v1/workspaces", {
    method: "POST",
    body: {
      project_id: projectId,
      name: title,
      ...(input.branch ? { branch: input.branch } : {}),
      anchors: [
        {
          type: "pstdio.planner.ticket",
          id: ticketId,
          projectId,
          label: shorthand,
          extensionId: "pstdio.planner",
          role: "primary",
        },
      ],
    },
  });
  const prompt = input.prompt ?? (readPlannerTicketContent(ticketRow) || title);
  const session =
    input.startSession === false
      ? null
      : await apiRequest<ApiCreateTicketAttemptResponse["session"]>("/v1/sessions", {
          method: "POST",
          body: {
            project_id: projectId,
            workspace_id: workspace.id,
            title,
            prompt,
            ...(input.agent ? { agent: input.agent } : {}),
            ...(input.model ? { model: input.model } : {}),
          },
        });

  return {
    ticketId,
    sessionId: session?.id ?? null,
    workspaceId: workspace.id,
    workspaceShorthand: workspace.workspace_shorthand,
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
