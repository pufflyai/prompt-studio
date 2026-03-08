import type { StatusResponse } from "pstdio-api/dto";
import type { Ticket, TicketStatus } from "@/features/ticket-list/types";
import { apiRequest } from "@/lib/api";
import { buildTicketStatusCatalog, toTicket } from "./mappers";
import type {
  ApiCreateTicketAndStartResponse,
  ApiTicket,
  CreateProjectTicketInput,
  CreateTicketAndStartInput,
  CreateTicketAndStartResult,
} from "./types";

const fetchTicketStatuses = async (projectId: string) => {
  const statuses = await apiRequest<StatusResponse[]>(`/v1/projects/${projectId}/ticket-statuses`);
  return buildTicketStatusCatalog(statuses);
};

export const getProjectTickets = async (projectId: string) => {
  const [statusCatalog, tickets] = await Promise.all([
    fetchTicketStatuses(projectId),
    apiRequest<ApiTicket[]>(`/v1/tickets?project_id=${projectId}`),
  ]);

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

export const updateProjectTicketStatus = async (projectId: string, ticket: Ticket, status: TicketStatus) => {
  const statusCatalog = await fetchTicketStatuses(projectId);
  const statusId = statusCatalog.idByName.get(status);

  if (!statusId) {
    throw new Error("Ticket status not found");
  }

  const updated = await apiRequest<ApiTicket>(`/v1/tickets/${ticket.id}`, {
    method: "PATCH",
    body: {
      display_title: ticket.title || undefined,
      user_prompt: ticket.content || undefined,
      status_id: statusId,
      tag_ids: ticket.tagIds,
      archived: Boolean(ticket.archived),
      ...(ticket.complexity != null && { complexity: ticket.complexity }),
    },
  });

  return toTicket(
    updated,
    statusCatalog.statusById,
    statusCatalog.colorById,
    statusCatalog.fallbackName,
    statusCatalog.fallbackColor,
  );
};

export const updateProjectTicket = async (projectId: string, ticket: Ticket) => {
  return updateProjectTicketStatus(projectId, ticket, ticket.status);
};

export const updateProjectTicketTags = async (ticketId: string, tagIds: string[]) => {
  const response = await apiRequest<{ ticket_id: string; tag_ids: string[] }>(`/v1/tickets/${ticketId}/tags`, {
    method: "PUT",
    body: { tag_ids: tagIds },
  });

  return {
    ticketId: response.ticket_id,
    tagIds: response.tag_ids,
  };
};

export const deleteProjectTicket = async (_projectId: string, ticketId: string) => {
  await apiRequest(`/v1/tickets/${ticketId}`, { method: "DELETE" });
};

export const createProjectTicket = async (input: CreateProjectTicketInput) => {
  const statusCatalog = await fetchTicketStatuses(input.projectId);
  const statusId = input.status ? statusCatalog.idByName.get(input.status) : null;

  if (input.status && !statusId) {
    throw new Error("Ticket status not found");
  }

  const ticket = await apiRequest<ApiTicket>("/v1/tickets", {
    method: "POST",
    body: {
      project_id: input.projectId,
      ...(input.content != null && { content: input.content }),
      ...(input.complexity != null && { complexity: input.complexity }),
      ...(statusId != null && { status_id: statusId }),
      ...(input.parentId != null && { parent_id: input.parentId }),
    },
  });

  return toTicket(
    ticket,
    statusCatalog.statusById,
    statusCatalog.colorById,
    statusCatalog.fallbackName,
    statusCatalog.fallbackColor,
  );
};

export const createTicketAndStart = async (input: CreateTicketAndStartInput) => {
  const response = await apiRequest<ApiCreateTicketAndStartResponse>("/v1/tickets/create-and-start", {
    method: "POST",
    body: {
      project_id: input.projectId,
      ...(input.content != null && { content: input.content }),
      ...(input.complexity != null && { complexity: input.complexity }),
      ...(input.dependsOn != null && { depends_on: input.dependsOn }),
      ...(input.statusId != null && { status_id: input.statusId }),
      ...(input.agent != null && { agent: input.agent }),
      ...(input.branch != null && { branch: input.branch }),
      ...(input.repoId != null && { repo_id: input.repoId }),
    },
  });

  return {
    ticketId: response.ticket.id,
    sessionId: response.session.id,
    workspaceId: response.workspace.id,
  } satisfies CreateTicketAndStartResult;
};
