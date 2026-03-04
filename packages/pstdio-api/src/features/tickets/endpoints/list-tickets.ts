import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { ticket_statuses } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { ticketListItemSchema } from "../dto";

const listTicketsQuerySchema = z.object({
  project_id: z.string(),
  status: z.string().optional(),
  tag: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.string().optional(),
  complexity: z.string().optional(),
  archived: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  draft: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  parent_id: z.string().optional(),
  shorthand: z.string().optional(),
});

export const listTicketsRoute = createRoute({
  method: "get",
  path: "/tickets",
  description: "List tickets for a project.",
  tags: ["Tickets"],
  request: {
    query: listTicketsQuerySchema,
  },
  responses: {
    200: {
      description: "List of tickets.",
      content: { "application/json": { schema: z.array(ticketListItemSchema) } },
    },
  },
});

export const listTicketsHandler = (deps: RouteDeps): AppRouteHandler<typeof listTicketsRoute> => {
  return async (c) => {
    const query = c.req.valid("query");

    let statusId: string | undefined;
    if (query.status) {
      const [status] = await deps.db
        .select()
        .from(ticket_statuses)
        .where(eq(ticket_statuses.project_id, query.project_id))
        .then((rows) => rows.filter((r) => r.name === query.status));

      if (status) statusId = status.id;
    }

    const tickets = await deps.ticketsService.list(query.project_id, {
      status_id: statusId,
      priority: query.priority,
      complexity: query.complexity,
      archived: query.archived,
      draft: query.draft,
      parent_id: query.parent_id,
      shorthand: query.shorthand,
    });

    const statuses = await deps.db
      .select()
      .from(ticket_statuses)
      .where(eq(ticket_statuses.project_id, query.project_id));

    const statusMap = new Map(statuses.map((s) => [s.id, s.name]));

    const enriched = await Promise.all(
      tickets.map(async (t) => {
        const tags = await deps.ticketsService.getTagAssignments(t.id);
        return {
          ...t,
          status_name: t.status_id ? (statusMap.get(t.status_id) ?? null) : null,
          tag_names: tags.map((tag) => tag.name),
        };
      }),
    );

    return c.json(enriched, 200);
  };
};
