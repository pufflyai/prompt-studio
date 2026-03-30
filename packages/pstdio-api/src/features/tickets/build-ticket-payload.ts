import type { HookPayload } from "pstdio-wt";
import type { RouteDeps } from "../deps";

type TicketRecord = {
  id: string;
  shorthand: string;
  display_title: string | null;
  user_prompt: string | null;
  parent_id: string | null;
  draft: boolean;
  archived: boolean;
  status_id: string | null;
};

export type BuildPayloadDeps = Pick<RouteDeps, "ticketService" | "fileService" | "statusService">;

const resolveStatusName = async (deps: BuildPayloadDeps, projectId: string, statusId: string | null) => {
  if (!statusId) return null;
  const statuses = await deps.statusService.list(projectId);
  return statuses.find((s) => s.id === statusId)?.name ?? null;
};

const resolveTagData = async (deps: BuildPayloadDeps, ticketId: string) => {
  const tagOptions = await deps.ticketService.getTagOptionAssignments(ticketId);
  return {
    tag_ids: tagOptions.map((t) => t.id),
    tag_names: tagOptions.map((t) => t.name),
  };
};

const resolveFileIds = async (deps: BuildPayloadDeps, ticketId: string) => {
  const files = await deps.fileService.listForTicket(ticketId);
  return files.map((f) => f.id);
};

export const buildTicketPayload = async (
  deps: BuildPayloadDeps,
  ticket: TicketRecord,
  projectId: string,
): Promise<HookPayload> => {
  const [status, tags, fileIds] = await Promise.all([
    resolveStatusName(deps, projectId, ticket.status_id),
    resolveTagData(deps, ticket.id),
    resolveFileIds(deps, ticket.id),
  ]);

  return {
    id: ticket.id,
    ticket: ticket.shorthand,
    display_title: ticket.display_title,
    user_prompt: ticket.user_prompt,
    parent_id: ticket.parent_id,
    draft: ticket.draft,
    archived: ticket.archived,
    status,
    tag_ids: tags.tag_ids,
    tag_names: tags.tag_names,
    file_ids: fileIds,
  };
};
