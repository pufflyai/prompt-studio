import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TagsRouteDeps } from "../deps";

export const deleteTagRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/ticket-tags/{id}",
  description: "Delete a tag.",
  deprecated: true,
  tags: ["Tags"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        id: z.string().openapi({ description: "Tag ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Tag deleted.",
      content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } },
    },
  },
});

export const deleteTagHandler = (deps: TagsRouteDeps): AppRouteHandler<typeof deleteTagRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    await deps.tagService.remove(id);
    deps.eventBus.emit("ticket_tags", "delete", { id });
    return c.json({ deleted: true }, 200);
  };
};
