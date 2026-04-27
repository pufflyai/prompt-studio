import type { RouteDeps } from "../deps";
import { fireTicketHook, fireTicketHookAsync } from "../hooks/ticket-hooks";
import { archiveWorkspaceCascade } from "../workspaces/archive-workspace-cascade";
import { buildTicketPayload } from "./build-ticket-payload";
import { emitSyncedFile, emitSyncedTicketFile } from "./emit-ticket-file-sync";
import { extractTitleFromContent } from "./extract-title";

const TICKET_CONTENT_FILE_NAME = "ticket.md";

export type TicketUpdateOperationDeps = Pick<
  RouteDeps,
  | "eventBus"
  | "fileService"
  | "pluginService"
  | "repoService"
  | "sessionService"
  | "statusService"
  | "ticketService"
  | "workspaceService"
  | "workspaceSessionService"
>;

type TicketRecord = NonNullable<Awaited<ReturnType<TicketUpdateOperationDeps["ticketService"]["get"]>>>;

type StatusContext = {
  fromStatusName: string | undefined;
  toStatusName: string | undefined;
};

export class TicketUpdateRejectedError extends Error {}

export type TicketUpdateOperationInput = {
  content?: string;
  display_title?: string | null;
  user_prompt?: string;
  file_id?: string | null;
  parent_id?: string | null;
  status_id?: string | null;
  blocked_reason?: string | null;
  draft?: boolean;
  archived?: boolean;
  tag_ids?: string[];
};

const upsertTicketContentFile = async (input: {
  deps: TicketUpdateOperationDeps;
  ticketId: string;
  projectId: string;
  currentFileId: string | null;
  content: string;
}) => {
  const { deps, ticketId, projectId, currentFileId, content } = input;
  const data = Buffer.from(content);

  if (currentFileId) {
    const updated = await deps.fileService.update(currentFileId, { data });
    if (updated) {
      emitSyncedFile(deps, updated);
      return currentFileId;
    }
  }

  const uploaded = await deps.fileService.upload({
    project_id: projectId,
    file_name: TICKET_CONTENT_FILE_NAME,
    file_kind: "ticket_file",
    data,
    mime_type: "text/markdown",
  });

  const ticketFile = await deps.fileService.attachToTicket(ticketId, uploaded.id);
  emitSyncedFile(deps, uploaded);
  emitSyncedTicketFile(deps, ticketFile);

  return uploaded.id;
};

const replaceTagAssignments = async (deps: TicketUpdateOperationDeps, ticketId: string, tagIds: string[]) => {
  const oldAssignments = await deps.ticketService.listTagAssignments(ticketId);
  for (const row of oldAssignments) deps.eventBus.emit("ticket_tag_assignments", "delete", { id: row.id });

  await deps.ticketService.assignTagOptions(ticketId, tagIds);

  const newAssignments = await deps.ticketService.listTagAssignments(ticketId);
  for (const row of newAssignments) deps.eventBus.emit("ticket_tag_assignments", "set", row);
};

const resolveStatusContext = async (
  deps: Pick<TicketUpdateOperationDeps, "statusService">,
  projectId: string,
  fromStatusId: string | null,
  toStatusId: string | null,
) => {
  const statuses = await deps.statusService.list(projectId);
  return {
    fromStatusName: fromStatusId ? statuses.find((s) => s.id === fromStatusId)?.name : undefined,
    toStatusName: toStatusId ? statuses.find((s) => s.id === toStatusId)?.name : undefined,
  };
};

const runPreUpdateHooks = async (
  deps: TicketUpdateOperationDeps,
  existing: TicketRecord,
  input: { status_id?: string | null; archived?: boolean },
  statusContext?: StatusContext,
) => {
  const statusChanging = input.status_id !== undefined && input.status_id !== existing.status_id;
  const archiving = input.archived === true;

  if (statusChanging) {
    const basePayload = await buildTicketPayload(deps, existing, existing.project_id);
    const result = await fireTicketHook(deps, "preTicketStatusChange", existing.project_id, {
      ...basePayload,
      fromStatus: statusContext?.fromStatusName ?? null,
      toStatus: statusContext?.toStatusName ?? null,
    });
    if (result.rejected)
      return { rejected: true, error: result.stderr.trim() || "Rejected by pre-ticket-status-change hook" };
  }

  if (archiving) {
    const basePayload = await buildTicketPayload(deps, existing, existing.project_id);
    const result = await fireTicketHook(deps, "preTicketArchive", existing.project_id, basePayload);
    if (result.rejected)
      return { rejected: true, error: result.stderr.trim() || "Rejected by pre-ticket-archive hook" };
  }

  return { rejected: false, error: "" };
};

const resolveUpdateState = async (
  deps: TicketUpdateOperationDeps,
  existing: TicketRecord,
  input: Pick<TicketUpdateOperationInput, "status_id" | "archived">,
) => {
  const statusChanging = input.status_id !== undefined && input.status_id !== existing.status_id;
  const archiving = input.archived === true && !existing.archived;
  const statusContext = statusChanging
    ? await resolveStatusContext(deps, existing.project_id, existing.status_id, input.status_id ?? null)
    : undefined;

  return {
    statusChanging,
    archiving,
    statusContext,
  };
};

const buildTicketUpdateInput = async (
  deps: TicketUpdateOperationDeps,
  id: string,
  existing: { project_id: string; file_id: string | null },
  input: Omit<TicketUpdateOperationInput, "content" | "tag_ids">,
  content: string | undefined,
) => {
  const nextInput = { ...input };

  if (content === undefined) {
    return nextInput;
  }

  if (nextInput.display_title === undefined) {
    nextInput.display_title = extractTitleFromContent(content);
  }
  nextInput.file_id = await upsertTicketContentFile({
    deps,
    ticketId: id,
    projectId: existing.project_id,
    currentFileId: existing.file_id,
    content,
  });

  return nextInput;
};

const archiveTicketWorkspaces = async (deps: TicketUpdateOperationDeps, ticketId: string) => {
  const workspaces = await deps.workspaceService.listByTicketId(ticketId);
  await Promise.all(workspaces.map((workspace) => archiveWorkspaceCascade(deps, workspace)));
};

const finalizeUpdatedTicket = async (input: {
  deps: TicketUpdateOperationDeps;
  ticketId: string;
  projectId: string;
  updated: TicketRecord;
  tagIds: string[] | undefined;
  statusChanging: boolean;
  archiving: boolean;
  statusContext?: StatusContext;
}) => {
  const { deps, ticketId, projectId, updated, tagIds, statusChanging, archiving, statusContext } = input;

  if (archiving) {
    await archiveTicketWorkspaces(deps, ticketId);
  }

  if (tagIds) {
    await replaceTagAssignments(deps, ticketId, tagIds);
  }

  deps.eventBus.emit("tickets", "set", updated);

  if (!statusChanging && !archiving) {
    return;
  }

  const postPayload = await buildTicketPayload(deps, updated, projectId);

  if (statusChanging) {
    fireTicketHookAsync(deps, "postTicketStatusChange", projectId, {
      ...postPayload,
      fromStatus: statusContext?.fromStatusName ?? null,
      toStatus: statusContext?.toStatusName ?? null,
    });
  }

  if (archiving) {
    fireTicketHookAsync(deps, "postTicketArchive", projectId, postPayload);
  }
};

export const updateTicketWithHooks = async (
  deps: TicketUpdateOperationDeps,
  id: string,
  input: TicketUpdateOperationInput,
) => {
  const { content, tag_ids, ...fields } = input;

  const existing = await deps.ticketService.get(id);
  if (!existing) {
    return null;
  }

  const { statusChanging, archiving, statusContext } = await resolveUpdateState(deps, existing, fields);
  const preHookResult = await runPreUpdateHooks(
    deps,
    existing,
    {
      status_id: fields.status_id,
      archived: fields.archived,
    },
    statusContext,
  );

  if (preHookResult.rejected) {
    throw new TicketUpdateRejectedError(preHookResult.error);
  }

  const nextInput = await buildTicketUpdateInput(deps, id, existing, fields, content);
  const updated = await deps.ticketService.update(id, nextInput);

  if (!updated) {
    return null;
  }

  await finalizeUpdatedTicket({
    deps,
    ticketId: id,
    projectId: existing.project_id,
    updated,
    tagIds: tag_ids,
    statusChanging,
    archiving,
    statusContext,
  });

  return updated;
};
