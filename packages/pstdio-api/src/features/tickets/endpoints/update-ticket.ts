import { createRoute, z } from "@hono/zod-openapi";
import { eq, ticket_tag_assignments } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, ticketResponseSchema, updateTicketBodySchema } from "../dto";
import { extractTitleFromContent } from "../extract-title";
import { queueTicketHooks } from "./ticket-hooks";

const TICKET_CONTENT_FILE_NAME = "ticket.md";

type TicketRecord = NonNullable<Awaited<ReturnType<RouteDeps["ticketsService"]["get"]>>>;

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
    if (updated) return currentFileId;
  }

  const uploaded = await deps.filesService.upload({
    project_id: projectId,
    file_name: TICKET_CONTENT_FILE_NAME,
    file_kind: "ticket_file",
    data,
    mime_type: "text/markdown",
  });

  await deps.filesService.attachToTicket(ticketId, uploaded.id);

  return uploaded.id;
};

const syncTicketTagAssignments = async (deps: RouteDeps, ticketId: string, tagIds: string[]) => {
  const oldAssignments = await deps.db
    .select()
    .from(ticket_tag_assignments)
    .where(eq(ticket_tag_assignments.ticket_id, ticketId));
  for (const row of oldAssignments) deps.eventBus.emit("ticket_tag_assignments", "delete", { id: row.id });

  await deps.ticketsService.assignTags(ticketId, tagIds);

  const newAssignments = await deps.db
    .select()
    .from(ticket_tag_assignments)
    .where(eq(ticket_tag_assignments.ticket_id, ticketId));
  for (const row of newAssignments) deps.eventBus.emit("ticket_tag_assignments", "set", row);
};

const buildTicketUpdateHooks = (existing: TicketRecord, updated: TicketRecord) => {
  const hooks = [] as Array<{
    hookName: "on-ticket-status-change" | "on-ticket-archive";
    context: {
      projectId: string;
      ticketId: string;
      ticketShorthand: string;
      ticketStatusOld?: string;
      ticketStatusNew?: string;
      ticketArchivedAt?: string;
    };
  }>;

  if (existing.status_id !== updated.status_id && updated.status_id !== null) {
    hooks.push({
      hookName: "on-ticket-status-change",
      context: {
        projectId: updated.project_id,
        ticketId: updated.id,
        ticketShorthand: updated.shorthand,
        ticketStatusOld: existing.status_id ?? undefined,
        ticketStatusNew: updated.status_id,
      },
    });
  }

  if (existing.archived !== updated.archived) {
    hooks.push({
      hookName: "on-ticket-archive",
      context: {
        projectId: updated.project_id,
        ticketId: updated.id,
        ticketShorthand: updated.shorthand,
        ticketArchivedAt: updated.archived ? updated.updated_at : undefined,
      },
    });
  }

  return hooks;
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

    if (tag_ids) await syncTicketTagAssignments(deps, id, tag_ids);

    deps.eventBus.emit("tickets", "set", updated);

    const hooks = buildTicketUpdateHooks(existing, updated);

    void queueTicketHooks(deps, {
      projectId: updated.project_id,
      hooks,
    });

    return c.json(updated, 200);
  };
};
