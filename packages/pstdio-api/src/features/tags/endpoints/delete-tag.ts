import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

export const deleteTagRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/tags/{id}",
  description: "Soft-delete a tag.",
  tags: ["Tags"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
      id: z.string().openapi({ description: "Tag ID" }),
    }),
  },
  responses: {
    200: {
      description: "Tag deleted.",
      content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } },
    },
  },
});

export const deleteTagHandler = (deps: RouteDeps): AppRouteHandler<typeof deleteTagRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    await deps.tagsService.softDelete(id);
    deps.eventBus.emit("ticket_tags", "delete", id);
    return c.json({ deleted: true }, 200);
  };
};
