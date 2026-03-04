import { readFileSync } from "node:fs";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, templateWithContentResponseSchema } from "../dto";

export const getTemplateRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/templates/{name}",
  description: "Get a template by name, including its content.",
  tags: ["Templates"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
      name: z.string().openapi({ description: "Template name" }),
    }),
  },
  responses: {
    200: {
      description: "Template found.",
      content: { "application/json": { schema: templateWithContentResponseSchema } },
    },
    404: {
      description: "Template not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getTemplateHandler = (deps: RouteDeps): AppRouteHandler<typeof getTemplateRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const template = await deps.templatesService.getByName(projectId, name);

    if (!template) {
      return c.json({ error: `Template not found: ${name}` }, 404);
    }

    const file = await deps.filesService.get(template.file_id);
    const content = file ? readFileSync(file.storage_path, "utf8") : "";

    return c.json({ ...template, content }, 200);
  };
};
