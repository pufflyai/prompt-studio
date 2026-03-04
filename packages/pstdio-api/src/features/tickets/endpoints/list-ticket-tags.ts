import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { ticket_tags } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const ticketTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

export const listTicketTagsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/ticket-tags",
  description: "List ticket tags for a project.",
  tags: ["Tickets"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
    }),
  },
  responses: {
    200: {
      description: "List of ticket tags.",
      content: { "application/json": { schema: z.array(ticketTagSchema) } },
    },
  },
});

export const listTicketTagsHandler = (deps: RouteDeps): AppRouteHandler<typeof listTicketTagsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");

    const tags = await deps.db
      .select({ id: ticket_tags.id, name: ticket_tags.name, color: ticket_tags.color })
      .from(ticket_tags)
      .where(eq(ticket_tags.project_id, projectId));

    return c.json(tags, 200);
  };
};
