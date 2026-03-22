import { createRoute, z } from "@hono/zod-openapi";
import { eq, ticket_tag_assignments } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { createTicketBodySchema, ticketResponseSchema } from "../dto";
import { extractTitleFromContent } from "../extract-title";

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

    let ticket = await deps.ticketsService.create({
      ...input,
      display_title: displayTitle,
    });

    if (content) {
      const data = Buffer.from(content);
      const file = await deps.filesService.upload({
        project_id: input.project_id,
        file_name: "ticket.md",
        file_kind: "ticket_file",
        data,
        mime_type: "text/markdown",
      });
      await deps.filesService.attachToTicket(ticket.id, file.id);
      const updated = await deps.ticketsService.update(ticket.id, { file_id: file.id });
      if (!updated) {
        throw new Error(`Ticket not found right after creation: ${ticket.id}`);
      }
      ticket = updated;
    }

    if (tag_ids && tag_ids.length > 0) {
      await deps.ticketsService.assignTagOptions(ticket.id, tag_ids);

      const newAssignments = await deps.db
        .select()
        .from(ticket_tag_assignments)
        .where(eq(ticket_tag_assignments.ticket_id, ticket.id));
      for (const row of newAssignments) deps.eventBus.emit("ticket_tag_assignments", "set", row);
    }

    deps.eventBus.emit("tickets", "set", ticket);

    return c.json(ticket, 201);
  };
};
