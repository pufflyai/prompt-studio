import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { conflictResponseSchema, copyTemplateBodySchema, notFoundResponseSchema, templateResponseSchema } from "../dto";

export const copyTemplateRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/templates/{name}/copy",
  description: "Copy an extension template default into a project-owned template.",
  tags: ["Templates"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z.string().openapi({ description: "Extension template name" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: copyTemplateBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Template copied.",
      content: { "application/json": { schema: templateResponseSchema } },
    },
    404: {
      description: "Extension template not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    409: {
      description: "Project template already exists.",
      content: { "application/json": { schema: conflictResponseSchema } },
    },
  },
});

export const copyTemplateHandler = (deps: RouteDeps): AppRouteHandler<typeof copyTemplateRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await deps.templateRegistryService.copyDefault(projectId, name, body);

    if ("error" in result) {
      if (result.error === "conflict") {
        return c.json({ error: `Template already exists: ${body.name}` }, 409);
      }

      return c.json({ error: `Extension template not found: ${name}` }, 404);
    }

    return c.json(result.template, 201);
  };
};
