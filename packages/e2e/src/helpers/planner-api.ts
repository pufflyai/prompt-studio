import { type APIRequestContext, expect } from "@playwright/test";

export interface PlannerTicketFile {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerTicket {
  id: string;
  shorthand: string;
  title: string;
  content: string;
  statusId: string | null;
  parentId?: string | null;
  tagIds?: string[];
  files?: PlannerTicketFile[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerStatus {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}

export interface PlannerTagOption {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
}

export interface PlannerTag {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
  options: PlannerTagOption[];
}

export interface PlannerWorkspace {
  id: string;
  workspace_shorthand: string;
  worktree_path: string;
  branch: string | null;
}

interface PlannerCommandBody {
  params?: Record<string, unknown>;
  resource?: Record<string, unknown>;
  repo?: Record<string, unknown>;
  source?: "api";
}

interface PlannerCommandResponse<TValue> {
  outcome: {
    ok: boolean;
    reason?: string;
    error?: { message?: string };
    value?: TValue;
  };
}

interface PlannerStatusesResult {
  statuses: PlannerStatus[];
}

interface PlannerTagsResult {
  tags: PlannerTag[];
}

const plannerCommandId = (command: string) =>
  command.startsWith("pstdio.pstdio-planner.command.") ? command : `pstdio.pstdio-planner.command.${command}`;

export const executePlannerCommand = async <TValue>(
  request: APIRequestContext,
  apiBase: string,
  projectId: string,
  command: string,
  params: Record<string, unknown> = {},
  body: Omit<PlannerCommandBody, "params" | "source"> = {},
) => {
  const commandId = plannerCommandId(command);
  const res = await request.post(
    `${apiBase}/v1/projects/${encodeURIComponent(projectId)}/extensions/commands/${encodeURIComponent(commandId)}/execute`,
    {
      data: {
        source: "api",
        params,
        ...body,
      },
    },
  );
  expect(res.ok()).toBe(true);

  const response = (await res.json()) as PlannerCommandResponse<TValue>;
  expect(response.outcome.ok, response.outcome.reason ?? response.outcome.error?.message).toBe(true);
  return response.outcome.value as TValue;
};

export const getPlannerTicketStatuses = async (request: APIRequestContext, apiBase: string, projectId: string) => {
  const result = await executePlannerCommand<PlannerStatusesResult | PlannerStatus[]>(
    request,
    apiBase,
    projectId,
    "ticketStatus.read",
  );
  return Array.isArray(result) ? result : result.statuses;
};

export const getPlannerTicketTags = async (request: APIRequestContext, apiBase: string, projectId: string) => {
  const result = await executePlannerCommand<PlannerTagsResult | PlannerTag[]>(
    request,
    apiBase,
    projectId,
    "ticketTag.read",
  );
  return Array.isArray(result) ? result : result.tags;
};

export const createPlannerTicket = (
  request: APIRequestContext,
  apiBase: string,
  projectId: string,
  input: { content: string; statusId?: string; tagIds?: string[]; parentId?: string },
) =>
  executePlannerCommand<PlannerTicket>(request, apiBase, projectId, "create-ticket", {
    content: input.content,
    ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
    ...(input.tagIds !== undefined ? { tagIds: input.tagIds } : {}),
    ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
  });

export const getPlannerTicket = (request: APIRequestContext, apiBase: string, projectId: string, id: string) =>
  executePlannerCommand<PlannerTicket | null>(request, apiBase, projectId, "get-ticket", { id });

export const listPlannerTickets = async (request: APIRequestContext, apiBase: string, projectId: string) => {
  const query = await executePlannerCommand<{ rows: Array<{ id: string }> }>(
    request,
    apiBase,
    projectId,
    "query-tickets",
  );
  const tickets = await Promise.all(query.rows.map((row) => getPlannerTicket(request, apiBase, projectId, row.id)));
  return tickets.filter((ticket): ticket is PlannerTicket => ticket !== null);
};

export const archivePlannerTicket = (request: APIRequestContext, apiBase: string, projectId: string, id: string) =>
  executePlannerCommand<PlannerTicket | null>(request, apiBase, projectId, "archive-ticket", { id });

export const createPlannerTag = async (
  request: APIRequestContext,
  apiBase: string,
  projectId: string,
  input: { name: string; type: "single_select" | "multi_select"; options: Array<{ name: string; color: string }> },
) => {
  const tag = await executePlannerCommand<PlannerTag>(request, apiBase, projectId, "ticketTag.create", {
    name: input.name,
    type: input.type,
  });

  for (const option of input.options) {
    await executePlannerCommand<PlannerTagOption>(request, apiBase, projectId, "ticketTag.createOption", {
      tagId: tag.id,
      name: option.name,
      color: option.color,
    });
  }

  const tags = await getPlannerTicketTags(request, apiBase, projectId);
  return tags.find((candidate) => candidate.id === tag.id) ?? tag;
};

export const createPlannerTicketFile = async (
  request: APIRequestContext,
  apiBase: string,
  projectId: string,
  ticketId: string,
  input: { name: string; content: string },
) => {
  const file = await executePlannerCommand<PlannerTicketFile & { ticketId: string }>(
    request,
    apiBase,
    projectId,
    "create-ticket-file",
    { ticketId, name: input.name },
    { resource: { type: "ticket", id: ticketId } },
  );
  await executePlannerCommand(request, apiBase, projectId, "update-ticket-file", {
    ticketId,
    fileId: file.id,
    content: input.content,
  });
  return file;
};

export const createPlannerAttempt = (
  request: APIRequestContext,
  apiBase: string,
  projectId: string,
  input: {
    ticketId: string;
    repoId?: string;
    mode?: "worktree" | "current_branch";
    startSession?: boolean;
    agent?: { harnessId: string; model?: string };
  },
) =>
  executePlannerCommand<{ workspace: PlannerWorkspace; session: { id: string } | null }>(
    request,
    apiBase,
    projectId,
    "run-attempt",
    {
      ticket: input.ticketId,
      mode: input.mode ?? "worktree",
      startSession: input.startSession ?? false,
      ...(input.agent !== undefined ? { agent: input.agent } : {}),
      ...(input.repoId !== undefined ? { repo: { repoId: input.repoId } } : {}),
    },
  );
