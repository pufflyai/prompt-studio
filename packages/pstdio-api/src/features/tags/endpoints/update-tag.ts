import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TagsRouteDeps } from "../deps";
import { tagResponseSchema, updateTagBodySchema } from "../dto";

export const updateTagRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/ticket-tags/{id}",
  description: "Update a tag definition.",
  tags: ["Tags"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        id: z.string().openapi({ description: "Tag definition ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: updateTagBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Tag definition updated.",
      content: { "application/json": { schema: tagResponseSchema } },
    },
  },
});

export const updateTagHandler = (deps: TagsRouteDeps): AppRouteHandler<typeof updateTagRoute> => {
  return async (c) => {
    const { projectId, id } = c.req.valid("param");
    const body = c.req.valid("json");
    await deps.tagService.update(id, body);

    const tags = await deps.tagService.listWithOptions(projectId);
    const updated = tags.find((t) => t.id === id);

    deps.eventBus.emit("ticket_tags", "set", { id, project_id: projectId, ...body });

    return c.json(updated!, 200);
  };
};
