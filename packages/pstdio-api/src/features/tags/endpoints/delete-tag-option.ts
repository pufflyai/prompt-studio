import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TagsRouteDeps } from "../deps";

export const deleteTagOptionRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/ticket-tags/{tagId}/options/{optionId}",
  description: "Delete a tag option.",
  deprecated: true,
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
  },
  responses: {
    200: {
      description: "Tag option deleted.",
      content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } },
    },
  },
});

export const deleteTagOptionHandler = (deps: TagsRouteDeps): AppRouteHandler<typeof deleteTagOptionRoute> => {
  return async (c) => {
    const { optionId } = c.req.valid("param");
    await deps.tagService.removeOption(optionId);
    deps.eventBus.emit("ticket_tag_options", "delete", { id: optionId });
    return c.json({ deleted: true }, 200);
  };
};
