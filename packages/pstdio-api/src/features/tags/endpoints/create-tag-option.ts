import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TagsRouteDeps } from "../deps";
import { createTagOptionBodySchema, tagOptionResponseSchema } from "../dto";

export const createTagOptionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/ticket-tags/{tagId}/options",
  description: "Add an option to a tag definition.",
  deprecated: true,
  tags: ["Tags"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        tagId: z.string().openapi({ description: "Tag definition ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: createTagOptionBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Tag option created.",
      content: { "application/json": { schema: tagOptionResponseSchema } },
    },
  },
});

export const createTagOptionHandler = (deps: TagsRouteDeps): AppRouteHandler<typeof createTagOptionRoute> => {
  return async (c) => {
    const { tagId } = c.req.valid("param");
    const body = c.req.valid("json");
    const option = await deps.tagService.createOption({ tag_id: tagId, ...body });
    deps.eventBus.emit("ticket_tag_options", "set", option);
    return c.json(option, 201);
  };
};
