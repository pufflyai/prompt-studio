import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TemplatesRouteDeps } from "../deps";
import { templateResponseSchema } from "../dto";

export const listTemplatesRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/templates",
  description: "List all templates for a project.",
  tags: ["Templates"],
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
      description: "List of templates.",
      content: { "application/json": { schema: z.array(templateResponseSchema) } },
    },
  },
});

export const listTemplatesHandler = (deps: TemplatesRouteDeps): AppRouteHandler<typeof listTemplatesRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const templates = await deps.templateService.list(projectId);
    return c.json(templates, 200);
  };
};
