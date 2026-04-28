import { createPlannerClient, type PlannerTicketCommandResult } from "@pstdio/pstdio-ext-planner/sdk";
import type { Ticket } from "@pstdio/sdk/resources";
import { API_URL } from "@/features/api-url";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

type UpdateTicketInput = {
  display_title?: string | null;
  user_prompt?: string | null;
  file_id?: string | null;
  status_id?: string | null;
  draft?: boolean;
  archived?: boolean;
  tag_ids?: string[];
  blocked_reason?: string | null;
  parent_id?: string | null;
};

const plannerClient = () =>
  createPlannerClient({
    baseUrl: process.env.PSTDIO_API_URL ?? API_URL,
    token: process.env.PSTDIO_API_TOKEN,
  });

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

export const updateTicket = async (
  projectIdOrId: string,
  idOrInput: string | UpdateTicketInput,
  maybeInput?: UpdateTicketInput,
) => {
  const hasProjectId = typeof idOrInput === "string";
  const projectId = hasProjectId ? projectIdOrId : resolveProjectId(process.cwd()).projectId;
  const id = hasProjectId ? idOrInput : projectIdOrId;
  const input = hasProjectId ? maybeInput! : idOrInput;

  const ticket = await plannerClient().updateTicket(projectId, {
    ticket_id: id,
    display_title: input.display_title,
    user_prompt: input.user_prompt,
    file_id: input.file_id,
    status_id: input.status_id,
    draft: input.draft,
    archived: input.archived,
    tag_ids: input.tag_ids,
    blocked_reason: input.blocked_reason,
    parent_id: input.parent_id,
  });

  return toTicket(ticket);
};
