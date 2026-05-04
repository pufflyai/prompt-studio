import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { StatusesRouteDeps } from "../deps";

export const deleteStatusRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/statuses/{id}",
  description: "Delete a ticket status.",
  tags: ["Statuses"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        id: z.string().openapi({ description: "Status ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Status deleted.",
      content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } },
    },
  },
});

export const deleteStatusHandler = (deps: StatusesRouteDeps): AppRouteHandler<typeof deleteStatusRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    await deps.statusService.remove(id);
    deps.eventBus.emit("ticket_statuses", "delete", { id });
    return c.json({ deleted: true }, 200);
  };
};
