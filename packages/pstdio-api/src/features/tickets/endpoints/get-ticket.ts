import { existsSync, readFileSync } from "node:fs";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TicketsRouteDeps } from "../deps";
import { notFoundResponseSchema, ticketDetailResponseSchema } from "../dto";

export const getTicketRoute = createRoute({
  method: "get",
  path: "/tickets/{id}",
  description: "Get a ticket by ID.",
  deprecated: true,
  tags: ["Tickets"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Ticket ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Ticket found.",
      content: { "application/json": { schema: ticketDetailResponseSchema } },
    },
    404: {
      description: "Ticket not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getTicketHandler = (deps: TicketsRouteDeps): AppRouteHandler<typeof getTicketRoute> => {
  const getTicketContent = async (fileId: string | null) => {
    if (!fileId) {
      return "";
    }

    const file = await deps.fileService.get(fileId);
    if (!file) {
      return "";
    }

    if (!existsSync(file.storage_path)) {
      return "";
    }

    return readFileSync(file.storage_path, "utf8");
  };

  return async (c) => {
    const { id } = c.req.valid("param");
    const ticket = await deps.ticketService.get(id);

    if (!ticket) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    return c.json(
      {
        ...ticket,
        content: await getTicketContent(ticket.file_id),
      },
      200,
    );
  };
};
