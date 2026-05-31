import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TagsRouteDeps } from "../deps";
import { tagResponseSchema } from "../dto";

export const listTagsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/ticket-tags",
  description: "List tag definitions for a project.",
  deprecated: true,
  tags: ["Tags"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "List of tag definitions with options.",
      content: { "application/json": { schema: z.array(tagResponseSchema) } },
    },
  },
});

export const listTagsHandler = (deps: TagsRouteDeps): AppRouteHandler<typeof listTagsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const tags = await deps.tagService.listWithOptions(projectId);
    return c.json(tags, 200);
  };
};
