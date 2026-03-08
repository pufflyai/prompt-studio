import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { statusResponseSchema } from "../dto";

export const updateStatusColorRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}/statuses/{id}",
  description: "Update a status color.",
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
          schema: z.object({ color: z.string() }).strict(),
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
    const { color } = c.req.valid("json");
    await deps.statusesService.updateColor(id, color);

    const statuses = await deps.statusesService.list(projectId);
    const updated = statuses.find((s) => s.id === id);

    deps.eventBus.emit("ticket_statuses", "set", { id, project_id: projectId, color });

    return c.json(updated!, 200);
  };
};
