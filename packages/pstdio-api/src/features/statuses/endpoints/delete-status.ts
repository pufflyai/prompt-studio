import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

export const deleteStatusRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/statuses/{id}",
  description: "Soft-delete a ticket status.",
  tags: ["Statuses"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
      id: z.string().openapi({ description: "Status ID" }),
    }),
  },
  responses: {
    200: {
      description: "Status deleted.",
      content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } },
    },
  },
});

export const deleteStatusHandler = (deps: RouteDeps): AppRouteHandler<typeof deleteStatusRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    await deps.statusesService.softDelete(id);
    deps.eventBus.emit("ticket_statuses", "delete", id);
    return c.json({ deleted: true }, 200);
  };
};
