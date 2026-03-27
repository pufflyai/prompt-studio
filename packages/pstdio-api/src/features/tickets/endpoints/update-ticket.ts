import { createRoute, z } from "@hono/zod-openapi";
import { eq, ticket_tag_assignments } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, ticketResponseSchema, updateTicketBodySchema } from "../dto";
import { emitSyncedFile, emitSyncedTicketFile } from "../emit-ticket-file-sync";
import { extractTitleFromContent } from "../extract-title";
import { fireTicketHook, fireTicketHookAsync } from "../ticket-hooks";

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
    const updated = await deps.filesService.update(currentFileId, { data });
    if (updated) {
      emitSyncedFile(deps, updated);
      return currentFileId;
    }
  }

  const uploaded = await deps.filesService.upload({
    project_id: projectId,
    file_name: TICKET_CONTENT_FILE_NAME,
    file_kind: "ticket_file",
    data,
    mime_type: "text/markdown",
  });

  const ticketFile = await deps.filesService.attachToTicket(ticketId, uploaded.id);
  emitSyncedFile(deps, uploaded);
  emitSyncedTicketFile(deps, ticketFile);

  return uploaded.id;
};

const replaceTagAssignments = async (deps: RouteDeps, ticketId: string, tagIds: string[]) => {
  const oldAssignments = await deps.db
    .select()
    .from(ticket_tag_assignments)
    .where(eq(ticket_tag_assignments.ticket_id, ticketId));
  for (const row of oldAssignments) deps.eventBus.emit("ticket_tag_assignments", "delete", { id: row.id });

  await deps.ticketsService.assignTagOptions(ticketId, tagIds);

  const newAssignments = await deps.db
    .select()
    .from(ticket_tag_assignments)
    .where(eq(ticket_tag_assignments.ticket_id, ticketId));
  for (const row of newAssignments) deps.eventBus.emit("ticket_tag_assignments", "set", row);
};

type TicketRecord = { id: string; shorthand: string; project_id: string; status_id: string | null };

const runPreUpdateHooks = async (
  deps: Pick<RouteDeps, "reposService">,
  existing: TicketRecord,
  input: { status_id?: string | null; archived?: boolean },
) => {
  const statusChanging = input.status_id !== undefined && input.status_id !== existing.status_id;
  const archiving = input.archived === true;

  if (statusChanging) {
    const result = await fireTicketHook(deps, "pre-ticket-status-change", existing.project_id, {
      id: existing.id,
      shorthand: existing.shorthand,
      from_status_id: existing.status_id,
      to_status_id: input.status_id,
    });
    if (result.rejected)
      return { rejected: true, error: result.stderr.trim() || "Rejected by pre-ticket-status-change hook" };
  }

  if (archiving) {
    const result = await fireTicketHook(deps, "pre-ticket-archive", existing.project_id, {
      id: existing.id,
      shorthand: existing.shorthand,
    });
    if (result.rejected)
      return { rejected: true, error: result.stderr.trim() || "Rejected by pre-ticket-archive hook" };
  }

  return { rejected: false, error: "" };
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

    const existing = await deps.ticketsService.get(id);
    if (!existing) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const statusChanging = input.status_id !== undefined && input.status_id !== existing.status_id;
    const archiving = input.archived === true && !existing.archived;

    const preHookResult = await runPreUpdateHooks(deps, existing, {
      status_id: input.status_id,
      archived: input.archived,
    });
    if (preHookResult.rejected) {
      return c.json({ error: preHookResult.error }, 403);
    }

    const nextInput = { ...input };

    if (content !== undefined) {
      nextInput.display_title = extractTitleFromContent(content);
      nextInput.file_id = await upsertTicketContentFile({
        deps,
        ticketId: id,
        projectId: existing.project_id,
        currentFileId: existing.file_id,
        content,
      });
    }

    const updated = await deps.ticketsService.update(id, nextInput);

    if (!updated) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    if (tag_ids) {
      await replaceTagAssignments(deps, id, tag_ids);
    }

    deps.eventBus.emit("tickets", "set", updated);

    if (statusChanging) {
      fireTicketHookAsync(deps, "post-ticket-status-change", existing.project_id, {
        id: updated.id,
        shorthand: updated.shorthand,
        status_id: updated.status_id,
      });
    }

    if (archiving) {
      fireTicketHookAsync(deps, "post-ticket-archive", existing.project_id, {
        id: updated.id,
        shorthand: updated.shorthand,
      });
    }

    return c.json(updated, 200);
  };
};
