import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

export const deleteTemplateRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/templates/{name}",
  description: "Soft-delete a template by name.",
  tags: ["Templates"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
      name: z.string().openapi({ description: "Template name" }),
    }),
  },
  responses: {
    204: {
      description: "Template deleted.",
    },
    404: {
      description: "Template not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const deleteTemplateHandler = (deps: RouteDeps): AppRouteHandler<typeof deleteTemplateRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const removed = await deps.templatesService.remove(projectId, name);

    if (!removed) {
      return c.json({ error: `Template not found: ${name}` }, 404);
    }

    return c.body(null, 204);
  };
};
