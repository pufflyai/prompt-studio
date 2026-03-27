import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { createTagBodySchema, tagResponseSchema } from "../dto";

export const createTagRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/ticket-tags",
  description: "Create a new tag definition for a project.",
  tags: ["Tags"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: createTagBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Tag definition created.",
      content: { "application/json": { schema: tagResponseSchema } },
    },
  },
});

export const createTagHandler = (deps: RouteDeps): AppRouteHandler<typeof createTagRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const { options: initialOptions, ...body } = c.req.valid("json");
    const tag = await deps.tagsService.create({ project_id: projectId, ...body });
    deps.eventBus.emit("ticket_tags", "set", tag);

    const createdOptions = [];
    if (initialOptions) {
      for (const opt of initialOptions) {
        const option = await deps.tagsService.createOption({ tag_id: tag.id, ...opt });
        deps.eventBus.emit("ticket_tag_options", "set", option);
        createdOptions.push(option);
      }
    }

    return c.json({ ...tag, options: createdOptions }, 201);
  };
};
