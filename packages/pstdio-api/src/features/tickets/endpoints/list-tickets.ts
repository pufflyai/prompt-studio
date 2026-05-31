import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TicketsRouteDeps } from "../deps";
import { ticketListItemSchema } from "../dto";

const listTicketsQuerySchema = z
  .object({
    project_id: z.string(),
    status: z.string().optional(),
    tag: z.union([z.string(), z.array(z.string())]).optional(),
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
    search: z.string().optional(),
  })
  .strict();

export const listTicketsRoute = createRoute({
  method: "get",
  path: "/tickets",
  description: "List tickets for a project.",
  deprecated: true,
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

export const listTicketsHandler = (deps: TicketsRouteDeps): AppRouteHandler<typeof listTicketsRoute> => {
  return async (c) => {
    const query = c.req.valid("query");

    let statusId: string | undefined;
    if (query.status) {
      const status = await deps.statusService.getByName(query.project_id, query.status);
      if (status) statusId = status.id;
    }

    const tickets = await deps.ticketService.list(query.project_id, {
      status_id: statusId,
      archived: query.archived,
      draft: query.draft,
      parent_id: query.parent_id,
      shorthand: query.shorthand,
      search: query.search,
    });

    const needStatusNames = tickets.some((t) => t.status_id);
    const statuses = needStatusNames ? await deps.statusService.list(query.project_id) : [];
    const statusMap = new Map(statuses.map((s) => [s.id, s.name]));

    const enriched = await Promise.all(
      tickets.map(async (t) => {
        const tags = await deps.ticketService.getTagOptionAssignments(t.id);
        return {
          ...t,
          status_name: t.status_id ? (statusMap.get(t.status_id) ?? null) : null,
          tag_ids: tags.map((tag) => tag.id),
          tag_names: tags.map((tag) => tag.name),
        };
      }),
    );

    return c.json(enriched, 200);
  };
};
