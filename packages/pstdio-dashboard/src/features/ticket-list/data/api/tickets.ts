import type { Ticket, TicketStatus } from "@/features/ticket-list/types";
import { apiRequest } from "@/lib/api";
import { buildTicketStatusCatalog, toTicket } from "./mappers";
import {
  executePlannerCommand,
  listPlannerCollection,
  readPlannerTicketContent,
  toPlannerStatusResponse,
  toPlannerTagResponses,
  toPlannerTicket,
  toPlannerTicketFromValue,
} from "./planner";
import type {
  ApiCreateTicketAndStartResponse,
  ApiTicket,
  CreateProjectTicketInput,
  CreateTicketAndStartInput,
  CreateTicketAndStartResult,
} from "./types";

const fetchTicketStatuses = async (projectId: string) => {
  const rows = await listPlannerCollection(projectId, "statuses");
  const statuses = rows.map(toPlannerStatusResponse);
  return buildTicketStatusCatalog(statuses);
};

const listApiTickets = async (projectId: string) => {
  const [ticketRows, statusRows, tagRows, tagOptionRows] = await Promise.all([
    listPlannerCollection(projectId, "tickets"),
    listPlannerCollection(projectId, "statuses"),
    listPlannerCollection(projectId, "tags"),
    listPlannerCollection(projectId, "tag_options"),
  ]);
  const statuses = statusRows.map(toPlannerStatusResponse);
  const tags = toPlannerTagResponses(tagRows, tagOptionRows);
  const statusNameById = new Map(statuses.map((status) => [status.id, status.name]));
  const tagNameById = new Map(tags.flatMap((tag) => tag.options.map((option) => [option.id, option.name] as const)));

  return ticketRows.map((row) => toPlannerTicket(row, statusNameById, tagNameById));
};

export const getProjectTickets = async (projectId: string) => {
  const [statusCatalog, tickets] = await Promise.all([fetchTicketStatuses(projectId), listApiTickets(projectId)]);

  return tickets.map((ticket) =>
    toTicket(
      ticket,
      statusCatalog.statusById,
      statusCatalog.colorById,
      statusCatalog.fallbackName,
      statusCatalog.fallbackColor,
    ),
  );
};

export const getProjectTicketContent = async (projectId: string, ticketId: string, _signal?: AbortSignal) => {
  const rows = await listPlannerCollection(projectId, "tickets");
  const ticket = rows.find((row) => {
    const value = row.value_json as { id?: unknown; shorthand?: unknown };
    return row.item_id === ticketId || value.id === ticketId || value.shorthand === ticketId;
  });
  return readPlannerTicketContent(ticket);
};

export const updateProjectTicketStatus = async (projectId: string, ticket: Ticket, status: TicketStatus) => {
  const statusCatalog = await fetchTicketStatuses(projectId);
  const statusId = statusCatalog.idByName.get(status);

  if (!statusId) {
    throw new Error("Ticket status not found");
  }

  const updated = await executePlannerCommand<unknown>(projectId, "updateTicket", {
    ticket_id: ticket.id,
    status_id: statusId,
  });
  const updatedTicket = toPlannerTicketFromValue(projectId, updated, statusCatalog.statusById);

  return toTicket(
    updatedTicket,
    statusCatalog.statusById,
    statusCatalog.colorById,
    statusCatalog.fallbackName,
    statusCatalog.fallbackColor,
  );
};

type UpdateProjectTicketInput = {
  title?: string;
  content?: string;
  archived?: boolean;
};

export const updateProjectTicket = async (projectId: string, ticketId: string, input: UpdateProjectTicketInput) => {
  const statusCatalog = await fetchTicketStatuses(projectId);
  const params: Record<string, unknown> = { ticket_id: ticketId };

  if (input.title !== undefined) params.display_title = input.title;
  if (input.content !== undefined) params.content = input.content;
  if (input.archived !== undefined) params.archived = input.archived;

  if (Object.keys(params).length === 1) {
    throw new Error("No ticket fields to update.");
  }

  const updated = await executePlannerCommand<unknown>(projectId, "updateTicket", params);
  const updatedTicket = toPlannerTicketFromValue(projectId, updated, statusCatalog.statusById);

  return toTicket(
    updatedTicket,
    statusCatalog.statusById,
    statusCatalog.colorById,
    statusCatalog.fallbackName,
    statusCatalog.fallbackColor,
  );
};

export const updateProjectTicketTags = async (projectId: string, ticketId: string, tagIds: string[]) => {
  await executePlannerCommand<ApiTicket>(projectId, "updateTicket", {
    ticket_id: ticketId,
    tag_ids: tagIds,
  });

  return { ticketId, tagIds };
};

export const deleteProjectTicket = async (_projectId: string, ticketId: string) => {
  await executePlannerCommand(_projectId, "deleteTicket", { ticket_id: ticketId });
};

export const createProjectTicket = async (input: CreateProjectTicketInput) => {
  const statusCatalog = await fetchTicketStatuses(input.projectId);
  const statusId = input.status ? statusCatalog.idByName.get(input.status) : null;

  if (input.status && !statusId) {
    throw new Error("Ticket status not found");
  }

  const created = await executePlannerCommand<unknown>(input.projectId, "createTicket", {
    content: input.content ?? input.title ?? "",
    title: input.title ?? input.content ?? undefined,
    ...(input.tagIds != null && { tag_ids: input.tagIds }),
    ...(statusId != null && { status_id: statusId }),
    ...(input.parentId != null && { parent_id: input.parentId }),
  });
  const ticket = toPlannerTicketFromValue(input.projectId, created, statusCatalog.statusById);

  return toTicket(
    ticket,
    statusCatalog.statusById,
    statusCatalog.colorById,
    statusCatalog.fallbackName,
    statusCatalog.fallbackColor,
  );
};

export const createTicketAndStart = async (input: CreateTicketAndStartInput) => {
  const statusCatalog = await fetchTicketStatuses(input.projectId);
  const created = await executePlannerCommand<unknown>(input.projectId, "createTicket", {
    content: input.content ?? "",
    ...(input.statusId != null && { status_id: input.statusId }),
  });
  const ticket = toPlannerTicketFromValue(input.projectId, created, statusCatalog.statusById);
  const workspace = await apiRequest<ApiCreateTicketAndStartResponse["workspace"]>("/v1/workspaces", {
    method: "POST",
    body: {
      project_id: input.projectId,
      name: ticket.shorthand,
      ...(input.branch != null && { branch: input.branch }),
      anchors: [
        {
          type: "pstdio.planner.ticket",
          id: ticket.id,
          projectId: input.projectId,
          label: ticket.shorthand,
          extensionId: "pstdio.planner",
          role: "primary",
        },
      ],
    },
  });
  const session = await apiRequest<ApiCreateTicketAndStartResponse["session"]>("/v1/sessions", {
    method: "POST",
    body: {
      project_id: input.projectId,
      workspace_id: workspace.id,
      title: ticket.display_title ?? ticket.shorthand,
      prompt: input.content ?? ticket.display_title ?? ticket.shorthand,
      ...(input.agent != null && { agent: input.agent }),
    },
  });

  return {
    ticketId: ticket.id,
    sessionId: session.id,
    workspaceId: workspace.id,
  } satisfies CreateTicketAndStartResult;
};
