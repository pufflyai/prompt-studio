import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { fireTicketHook, fireTicketHookAsync } from "../../hooks/ticket-hooks";
import { archiveWorkspaceCascade } from "../../workspaces/archive-workspace-cascade";
import { buildTicketPayload } from "../build-ticket-payload";
import { notFoundResponseSchema, ticketResponseSchema, updateTicketBodySchema } from "../dto";
import { emitSyncedFile, emitSyncedTicketFile } from "../emit-ticket-file-sync";
import { extractTitleFromContent } from "../extract-title";

const hookRejectedSchema = z.object({ error: z.string() });

const TICKET_CONTENT_FILE_NAME = "ticket.md";

const upsertTicketContentFile = async (input: {
  deps: RouteDeps;
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

const replaceTagAssignments = async (deps: RouteDeps, ticketId: string, tagIds: string[]) => {
  const oldAssignments = await deps.ticketService.listTagAssignments(ticketId);
  for (const row of oldAssignments) deps.eventBus.emit("ticket_tag_assignments", "delete", { id: row.id });

  await deps.ticketService.assignTagOptions(ticketId, tagIds);

  const newAssignments = await deps.ticketService.listTagAssignments(ticketId);
  for (const row of newAssignments) deps.eventBus.emit("ticket_tag_assignments", "set", row);
};

type TicketRecord = NonNullable<Awaited<ReturnType<RouteDeps["ticketService"]["get"]>>>;

type StatusContext = {
  fromStatusName: string | undefined;
  toStatusName: string | undefined;
};

type UpdateTicketInput = z.infer<typeof updateTicketBodySchema>;

const resolveStatusContext = async (
  deps: Pick<RouteDeps, "statusService">,
  projectId: string,
  fromStatusId: string | null,
  toStatusId: string | null,
): Promise<StatusContext> => {
  const statuses = await deps.statusService.list(projectId);
  return {
    fromStatusName: fromStatusId ? statuses.find((s) => s.id === fromStatusId)?.name : undefined,
    toStatusName: toStatusId ? statuses.find((s) => s.id === toStatusId)?.name : undefined,
  };
};

const runPreUpdateHooks = async (
  deps: RouteDeps,
  existing: TicketRecord & {
    display_title: string | null;
    user_prompt: string | null;
    parent_id: string | null;
    draft: boolean;
    archived: boolean;
  },
  input: { status_id?: string | null; archived?: boolean },
  statusContext?: StatusContext,
) => {
  const statusChanging = input.status_id !== undefined && input.status_id !== existing.status_id;
  const archiving = input.archived === true;

  if (statusChanging) {
    const basePayload = await buildTicketPayload(deps, existing, existing.project_id);
    const result = await fireTicketHook(deps, "pre-ticket-status-change", existing.project_id, {
      ...basePayload,
      from_status: statusContext?.fromStatusName ?? null,
      to_status: statusContext?.toStatusName ?? null,
    });
    if (result.rejected)
      return { rejected: true, error: result.stderr.trim() || "Rejected by pre-ticket-status-change hook" };
  }

  if (archiving) {
    const basePayload = await buildTicketPayload(deps, existing, existing.project_id);
    const result = await fireTicketHook(deps, "pre-ticket-archive", existing.project_id, basePayload);
    if (result.rejected)
      return { rejected: true, error: result.stderr.trim() || "Rejected by pre-ticket-archive hook" };
  }

  return { rejected: false, error: "" };
};

const resolveUpdateState = async (
  deps: RouteDeps,
  existing: TicketRecord & {
    archived: boolean;
  },
  input: Pick<UpdateTicketInput, "status_id" | "archived">,
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
  deps: RouteDeps,
  id: string,
  existing: { project_id: string; file_id: string | null },
  input: Omit<UpdateTicketInput, "content" | "tag_ids">,
  content: string | undefined,
) => {
  const nextInput = { ...input };

  if (content === undefined) {
    return nextInput;
  }

  nextInput.display_title = extractTitleFromContent(content);
  nextInput.file_id = await upsertTicketContentFile({
    deps,
    ticketId: id,
    projectId: existing.project_id,
    currentFileId: existing.file_id,
    content,
  });

  return nextInput;
};

const archiveTicketWorkspaces = async (deps: RouteDeps, ticketId: string) => {
  const workspaces = await deps.workspaceService.listByTicketId(ticketId);
  await Promise.all(workspaces.map((workspace) => archiveWorkspaceCascade(deps, workspace)));
};

const finalizeUpdatedTicket = async (input: {
  deps: RouteDeps;
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
    fireTicketHookAsync(deps, "post-ticket-status-change", projectId, {
      ...postPayload,
      from_status: statusContext?.fromStatusName ?? null,
      to_status: statusContext?.toStatusName ?? null,
    });
  }

  if (archiving) {
    fireTicketHookAsync(deps, "post-ticket-archive", projectId, postPayload);
  }
};

export const updateTicketRoute = createRoute({
  method: "patch",
  path: "/tickets/{id}",
  description: "Update a ticket.",
  tags: ["Tickets"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Ticket ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: updateTicketBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Ticket updated.",
      content: { "application/json": { schema: ticketResponseSchema } },
    },
    403: {
      description: "Rejected by hook.",
      content: { "application/json": { schema: hookRejectedSchema } },
    },
    404: {
      description: "Ticket not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const updateTicketHandler = (deps: RouteDeps): AppRouteHandler<typeof updateTicketRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { content, tag_ids, ...input } = c.req.valid("json");

    const existing = await deps.ticketService.get(id);
    if (!existing) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const { statusChanging, archiving, statusContext } = await resolveUpdateState(deps, existing, input);

    const preHookResult = await runPreUpdateHooks(
      deps,
      existing,
      {
        status_id: input.status_id,
        archived: input.archived,
      },
      statusContext,
    );
    if (preHookResult.rejected) {
      return c.json({ error: preHookResult.error }, 403);
    }

    const nextInput = await buildTicketUpdateInput(deps, id, existing, input, content);

    const updated = await deps.ticketService.update(id, nextInput);

    if (!updated) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
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

    return c.json(updated, 200);
  };
};
