import { readFileSync } from "node:fs";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

export const getTicketFileContentRoute = createRoute({
  method: "get",
  path: "/tickets/{id}/files/{fileId}/content",
  description: "Download the content of a ticket file.",
  tags: ["Tickets"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Ticket ID" }),
      fileId: z.string().openapi({ description: "File ID" }),
    }),
  },
  responses: {
    200: {
      description: "Ticket file content.",
      content: {
        "application/octet-stream": {
          schema: z.string().openapi({ type: "string", format: "binary" }),
        },
      },
    },
    404: {
      description: "Ticket or file not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getTicketFileContentHandler = (deps: RouteDeps): AppRouteHandler<typeof getTicketFileContentRoute> => {
  return async (c) => {
    const { id, fileId } = c.req.valid("param");
    const ticket = await deps.ticketsService.get(id);

    if (!ticket) {
      return c.json({ error: `Ticket not found: ${id}` }, 404);
    }

    const files = await deps.filesService.listForTicket(id);
    const file = files.find((item) => item.id === fileId);

    if (!file) {
      return c.json({ error: `Ticket file not found: ${fileId}` }, 404);
    }

    const content = readFileSync(file.storage_path);

    return c.body(content, 200, {
      "content-type": file.mime_type ?? "application/octet-stream",
    });
  };
};
