import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TagsRouteDeps } from "../deps";
import { tagOptionResponseSchema, updateTagOptionBodySchema } from "../dto";

export const updateTagOptionRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/ticket-tags/{tagId}/options/{optionId}",
  description: "Update a tag option.",
  tags: ["Tags"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        tagId: z.string().openapi({ description: "Tag definition ID" }),
        optionId: z.string().openapi({ description: "Tag option ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: updateTagOptionBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Tag option updated.",
      content: { "application/json": { schema: tagOptionResponseSchema } },
    },
  },
});

export const updateTagOptionHandler = (deps: TagsRouteDeps): AppRouteHandler<typeof updateTagOptionRoute> => {
  return async (c) => {
    const { tagId, optionId } = c.req.valid("param");
    const body = c.req.valid("json");
    await deps.tagService.updateOption(optionId, body);

    const options = await deps.tagService.listOptions(tagId);
    const updated = options.find((o) => o.id === optionId);

    deps.eventBus.emit("ticket_tag_options", "set", updated);

    return c.json(updated!, 200);
  };
};
