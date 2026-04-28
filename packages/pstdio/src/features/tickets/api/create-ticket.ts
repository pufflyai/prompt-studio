import { createPlannerClient, type PlannerTicketCommandResult } from "@pstdio/pstdio-ext-planner/sdk";
import type { CreateTicketInput } from "@pstdio/sdk/api";
import type { Ticket } from "@pstdio/sdk/resources";
import { apiClient } from "@/features/api-client";
import { API_URL } from "@/features/api-url";
import { listPlannerTickets } from "@/features/planner/api/planner-tickets";
import { extractRawTitle } from "../display-title";

const plannerClient = () =>
  createPlannerClient({
    baseUrl: process.env.PSTDIO_API_URL ?? API_URL,
    token: process.env.PSTDIO_API_TOKEN,
  });

const ticketNumber = (projectShorthand: string, shorthand: string) => {
  const match = shorthand.match(new RegExp(`^${projectShorthand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`));
  return match ? Number(match[1]) : 0;
};

const nextTicketShorthand = async (projectId: string) => {
  const project = await apiClient().projects.get(projectId);
  const [active, archived] = await Promise.all([
    listPlannerTickets({ project_id: projectId, archived: false }),
    listPlannerTickets({ project_id: projectId, archived: true }),
  ]);
  const nextNumber =
    Math.max(0, ...[...active, ...archived].map((ticket) => ticketNumber(project.shorthand, ticket.shorthand))) + 1;
  return `${project.shorthand}-${nextNumber}`;
};

const normalizeContent = (content: string | undefined) => {
  if (!content) return "";
  return content.startsWith("#") ? content : `# ${content}\n`;
};

const toTicket = (ticket: PlannerTicketCommandResult): Ticket => ({
  id: ticket.id,
  shorthand: ticket.shorthand,
  project_id: ticket.projectId,
  status_id: ticket.statusId ?? null,
  display_title: ticket.displayTitle ?? null,
  user_prompt: ticket.userPrompt,
  file_id: ticket.fileId,
  parent_id: ticket.parentId,
  parallelizable: ticket.parallelizable,
  blocked_reason: ticket.blockedReason,
  depends_on: ticket.dependsOn,
  draft: ticket.draft,
  archived: ticket.archived ?? false,
  deleted_at: null,
  created_at: ticket.createdAt,
  updated_at: ticket.updatedAt ?? ticket.createdAt,
});

export const createTicket = async (input: CreateTicketInput) => {
  const content = normalizeContent(input.content);
  const ticket = await plannerClient().createTicket(input.project_id, {
    shorthand: await nextTicketShorthand(input.project_id),
    content,
    title: extractRawTitle(content) ?? undefined,
    draft: input.draft ?? false,
    parent_id: input.parent_id ?? null,
    user_prompt: input.user_prompt ?? null,
    status_id: input.status_id ?? null,
    tag_ids: input.tag_ids,
  });

  return toTicket(ticket);
};
