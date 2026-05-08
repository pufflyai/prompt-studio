import { createRoute, z } from "@hono/zod-openapi";
import { ExtensionCatalogAssetError } from "../../../services/extension-asset-catalog";
import type { AppRouteHandler } from "../../../types";
import type { TemplatesRouteDeps } from "../deps";
import { badRequestResponseSchema, notFoundResponseSchema, templateWithContentResponseSchema } from "../dto";

export const getTemplateRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/templates/{name}",
  description: "Get a template by name, including its content.",
  tags: ["Templates"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z.string().openapi({ description: "Template name" }),
      })
      .strict(),
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
    400: {
      description: "Template source asset could not be resolved.",
      content: { "application/json": { schema: badRequestResponseSchema } },
    },
  },
});

export const getTemplateHandler = (deps: TemplatesRouteDeps): AppRouteHandler<typeof getTemplateRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    try {
      const template = await deps.templateService.getWithContent(projectId, name);

      if (!template) {
        return c.json({ error: `Template not found: ${name}` }, 404);
      }

      return c.json(template, 200);
    } catch (error) {
      if (error instanceof ExtensionCatalogAssetError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  };
};
