import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, ticketFileResponseSchema, uploadTicketFileBodySchema } from "../dto";

export const uploadTicketFileRoute = createRoute({
  method: "post",
  path: "/tickets/{id}/files",
  description: "Upload and attach a file to a ticket.",
  tags: ["Tickets"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Ticket ID" }),
    }),
    body: {
      content: { "application/json": { schema: uploadTicketFileBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Ticket file updated.",
      content: { "application/json": { schema: ticketFileResponseSchema } },
    },
    201: {
      description: "Ticket file created.",
      content: { "application/json": { schema: ticketFileResponseSchema } },
    },
    404: {
      description: "Ticket not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const uploadTicketFileHandler = (deps: RouteDeps): AppRouteHandler<typeof uploadTicketFileRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { file_name, content_base64, mime_type } = c.req.valid("json");

    const ticket = await deps.ticketsService.get(id);
    if (!ticket) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const data = Buffer.from(content_base64, "base64");
    const attachedFiles = await deps.filesService.listForTicket(id);
    const existing = attachedFiles.find((file) => file.file_name === file_name);

    if (existing) {
      const updated = await deps.filesService.update(existing.id, { data });
      return c.json(updated ?? existing, 200);
    }

    const file = await deps.filesService.upload({
      project_id: ticket.project_id,
      file_name,
      file_kind: "ticket_file",
      data,
      mime_type: mime_type ?? null,
    });

    await deps.filesService.attachToTicket(id, file.id);

    return c.json(file, 201);
  };
};
