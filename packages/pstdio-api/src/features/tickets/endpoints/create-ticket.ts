import { createRoute, z } from "@hono/zod-openapi";
import { eq, ticket_tag_assignments } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { createTicketBodySchema, ticketResponseSchema } from "../dto";
import { emitSyncedFile, emitSyncedTicketFile } from "../emit-ticket-file-sync";
import { extractTitleFromContent } from "../extract-title";
import { fireTicketHook, fireTicketHookAsync } from "../ticket-hooks";

const hookRejectedSchema = z.object({ error: z.string() });

type TicketRecord = Awaited<ReturnType<RouteDeps["ticketsService"]["create"]>>;

const attachContentToTicket = async (deps: RouteDeps, ticket: TicketRecord, projectId: string, content: string) => {
  const data = Buffer.from(content);
  const file = await deps.filesService.upload({
    project_id: projectId,
    file_name: "ticket.md",
    file_kind: "ticket_file",
    data,
    mime_type: "text/markdown",
  });
  const ticketFile = await deps.filesService.attachToTicket(ticket.id, file.id);
  emitSyncedFile(deps, file);
  emitSyncedTicketFile(deps, ticketFile);
  const updated = await deps.ticketsService.update(ticket.id, { file_id: file.id });
  if (!updated) throw new Error(`Ticket not found right after creation: ${ticket.id}`);
  return updated;
};

const assignTags = async (deps: RouteDeps, ticketId: string, tagIds: string[]) => {
  await deps.ticketsService.assignTagOptions(ticketId, tagIds);
  const newAssignments = await deps.db
    .select()
    .from(ticket_tag_assignments)
    .where(eq(ticket_tag_assignments.ticket_id, ticketId));
  for (const row of newAssignments) deps.eventBus.emit("ticket_tag_assignments", "set", row);
};

export const createTicketRoute = createRoute({
  method: "post",
  path: "/tickets",
  description: "Create a new ticket.",
  tags: ["Tickets"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: createTicketBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Ticket created.",
      content: { "application/json": { schema: ticketResponseSchema } },
    },
    403: {
      description: "Rejected by pre-ticket-creation hook.",
      content: { "application/json": { schema: hookRejectedSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const createTicketHandler = (deps: RouteDeps): AppRouteHandler<typeof createTicketRoute> => {
  return async (c) => {
    const { tag_ids, content, ...input } = c.req.valid("json");

    const project = await deps.projectsService.get(input.project_id);
    if (!project) {
      return c.json({ error: `Project not found: ${input.project_id}` }, 404);
    }

    if (!input.status_id) {
      const defaultStatus = await deps.statusesService.getDefault(input.project_id);
      if (defaultStatus) input.status_id = defaultStatus.id;
    }

    const displayTitle = content ? extractTitleFromContent(content) : undefined;

    const preHook = await fireTicketHook(deps, "pre-ticket-creation", input.project_id, {
      ...input,
      display_title: displayTitle,
      content,
    });
    if (preHook.rejected) {
      return c.json({ error: preHook.stderr.trim() || "Rejected by pre-ticket-creation hook" }, 403);
    }

    let ticket = await deps.ticketsService.create({
      ...input,
      display_title: displayTitle,
    });

    if (content) {
      ticket = await attachContentToTicket(deps, ticket, input.project_id, content);
    }

    if (tag_ids && tag_ids.length > 0) {
      await assignTags(deps, ticket.id, tag_ids);
    }

    deps.eventBus.emit("tickets", "set", ticket);
    fireTicketHookAsync(deps, "post-ticket-creation", input.project_id, {
      id: ticket.id,
      shorthand: ticket.shorthand,
    });

    return c.json(ticket, 201);
  };
};
