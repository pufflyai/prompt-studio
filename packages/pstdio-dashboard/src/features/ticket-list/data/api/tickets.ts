import type { Ticket, TicketStatus } from "@/features/ticket-list/types";
import { createTicketAttempt } from "./attempts";
import {
  buildTicketStatusCatalog,
  executePlannerCommand,
  type PlannerTicket,
  readPlannerTicket,
  readPlannerTicketStatuses,
  readPlannerTickets,
  toTicket,
} from "./planner";
import type { CreateProjectTicketInput, CreateTicketAndStartInput, CreateTicketAndStartResult } from "./types";

export const getProjectTickets = async (projectId: string) => {
  const [statuses, tickets] = await Promise.all([readPlannerTicketStatuses(projectId), readPlannerTickets(projectId)]);
  const statusCatalog = buildTicketStatusCatalog(statuses);

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

export const getProjectTicketContent = async (projectId: string, ticketId: string, signal?: AbortSignal) => {
  const ticket = await readPlannerTicket(projectId, ticketId, signal);
  return ticket?.content ?? "";
};

export const updateProjectTicketStatus = async (projectId: string, ticket: Ticket, status: TicketStatus) => {
  const updated = await executePlannerCommand(projectId, "update-ticket", {
    id: ticket.id,
    status,
  });
  return updated;
};

type UpdateProjectTicketInput = {
  title?: string;
  content?: string;
  archived?: boolean;
};

export const updateProjectTicket = async (projectId: string, ticketId: string, input: UpdateProjectTicketInput) => {
  if (input.archived === true) {
    return executePlannerCommand(projectId, "archive-ticket", { id: ticketId });
  }

  if (input.archived === false) {
    throw new Error("Planner tickets do not support unarchive from the legacy dashboard route.");
  }

  if (input.content === undefined) {
    throw new Error("No ticket fields to update.");
  }

  return executePlannerCommand(projectId, "update-ticket", {
    id: ticketId,
    content: input.content,
  });
};

export const updateProjectTicketTags = async (projectId: string, ticketId: string, tagIds: string[]) => {
  await executePlannerCommand(projectId, "set-ticket-tags", { rowId: ticketId, tagIds });
  return { ticketId, tagIds };
};

export const deleteProjectTicket = async (projectId: string, ticketId: string) => {
  await executePlannerCommand(projectId, "delete-ticket", { id: ticketId });
};

export const createProjectTicket = async (input: CreateProjectTicketInput) => {
  const statuses = await readPlannerTicketStatuses(input.projectId);
  const statusCatalog = buildTicketStatusCatalog(statuses);
  const statusId = input.status ? statusCatalog.idByName.get(input.status) : null;

  if (input.status && !statusId) {
    throw new Error("Ticket status not found");
  }

  const ticket = await executePlannerCommand<PlannerTicket>(input.projectId, "create-ticket", {
    ...(input.content != null && { content: input.content }),
    ...(input.tagIds != null && { tagIds: input.tagIds }),
    ...(statusId != null && { statusId }),
    ...(input.parentId != null && { parentId: input.parentId }),
  });

  return ticket;
};

export const createTicketAndStart = async (input: CreateTicketAndStartInput) => {
  const ticket = await executePlannerCommand<{ id: string }>(input.projectId, "create-ticket", {
    ...(input.content != null && { content: input.content }),
    ...(input.dependsOn != null && { dependsOn: input.dependsOn }),
    ...(input.statusId != null && { statusId: input.statusId }),
  });
  const attempt = await createTicketAttempt({
    ticketId: ticket.id,
    projectId: input.projectId,
    agent: input.agent,
    branch: input.branch,
    repoId: input.repoId,
    startSession: true,
  });

  return {
    ticketId: ticket.id,
    sessionId: attempt.sessionId ?? "",
    workspaceId: attempt.workspaceId,
  } satisfies CreateTicketAndStartResult;
};
