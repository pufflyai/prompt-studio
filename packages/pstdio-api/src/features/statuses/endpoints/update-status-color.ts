import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { statusResponseSchema } from "../dto";

export const updateStatusColorRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}/statuses/{id}",
  description: "Update status metadata.",
  tags: ["Statuses"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        id: z.string().openapi({ description: "Status ID" }),
      })
      .strict(),
    body: {
      content: {
        "application/json": {
          schema: z
            .object({
              name: z.string().optional(),
              color: z.string().optional(),
              sort_order: z.number().int().optional(),
              can_create: z.boolean().optional(),
              can_drag_in: z.boolean().optional(),
              can_drag_out: z.boolean().optional(),
              column_actions: z.array(z.string()).optional(),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Status updated.",
      content: { "application/json": { schema: statusResponseSchema } },
    },
  },
});

export const updateStatusColorHandler = (deps: RouteDeps): AppRouteHandler<typeof updateStatusColorRoute> => {
  return async (c) => {
    const { projectId, id } = c.req.valid("param");
    const input = c.req.valid("json");
    await deps.statusService.update(id, input);

    const statuses = await deps.statusService.list(projectId);
    const row = statuses.find((s) => s.id === id)!;
    const updated = { ...row, column_actions: JSON.parse(row.column_actions) as string[] };

    deps.eventBus.emit("ticket_statuses", "set", row);

    return c.json(updated, 200);
  };
};
