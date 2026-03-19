import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { createTagBodySchema, tagResponseSchema } from "../dto";

export const updateTagRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/ticket-tags/{id}",
  description: "Update a tag.",
  tags: ["Tags"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        id: z.string().openapi({ description: "Tag ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: createTagBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Tag updated.",
      content: { "application/json": { schema: tagResponseSchema } },
    },
  },
});

export const updateTagHandler = (deps: RouteDeps): AppRouteHandler<typeof updateTagRoute> => {
  return async (c) => {
    const { projectId, id } = c.req.valid("param");
    const body = c.req.valid("json");
    await deps.tagsService.update(id, body);

    const tags = await deps.tagsService.list(projectId);
    const updated = tags.find((t) => t.id === id);

    deps.eventBus.emit("ticket_tags", "set", { id, project_id: projectId, ...body });

    return c.json(updated!, 200);
  };
};
