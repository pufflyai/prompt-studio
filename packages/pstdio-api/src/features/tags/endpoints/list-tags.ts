import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { tagResponseSchema } from "../dto";

export const listTagsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/tags",
  description: "List tags for a project.",
  tags: ["Tags"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
    }),
  },
  responses: {
    200: {
      description: "List of tags.",
      content: { "application/json": { schema: z.array(tagResponseSchema) } },
    },
  },
});

export const listTagsHandler = (deps: RouteDeps): AppRouteHandler<typeof listTagsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const tags = await deps.tagsService.list(projectId);
    return c.json(tags, 200);
  };
};
