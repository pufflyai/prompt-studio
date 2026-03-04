import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, templateResponseSchema, updateTemplateBodySchema } from "../dto";

export const updateTemplateRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/templates/{name}",
  description: "Update a template's content or default status.",
  tags: ["Templates"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
      name: z.string().openapi({ description: "Template name" }),
    }),
    body: {
      content: { "application/json": { schema: updateTemplateBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Template updated.",
      content: { "application/json": { schema: templateResponseSchema } },
    },
    404: {
      description: "Template not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const updateTemplateHandler = (deps: RouteDeps): AppRouteHandler<typeof updateTemplateRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await deps.templatesService.getByName(projectId, name);
    if (!existing) {
      return c.json({ error: `Template not found: ${name}` }, 404);
    }

    let newFileId: string | undefined;
    if (body.content) {
      const file = await deps.filesService.update(existing.file_id, {
        data: Buffer.from(body.content),
      });
      if (file) newFileId = file.id;
    }

    const updated = await deps.templatesService.update(projectId, name, {
      file_id: newFileId,
      is_default: body.is_default,
    });

    if (!updated) {
      return c.json({ error: `Template not found: ${name}` }, 404);
    }

    deps.eventBus.emit("templates", "set", updated);

    return c.json(updated, 200);
  };
};
