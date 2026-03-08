import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { tagResponseSchema } from "../dto";

export const updateTagColorRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}/tags/{id}",
  description: "Update a tag color.",
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
      content: {
        "application/json": {
          schema: z.object({ color: z.string() }).strict(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Tag updated.",
      content: { "application/json": { schema: tagResponseSchema } },
    },
  },
});

export const updateTagColorHandler = (deps: RouteDeps): AppRouteHandler<typeof updateTagColorRoute> => {
  return async (c) => {
    const { projectId, id } = c.req.valid("param");
    const { color } = c.req.valid("json");
    await deps.tagsService.updateColor(id, color);

    const tags = await deps.tagsService.list(projectId);
    const updated = tags.find((t) => t.id === id);

    deps.eventBus.emit("ticket_tags", "set", { id, project_id: projectId, color });

    return c.json(updated!, 200);
  };
};
