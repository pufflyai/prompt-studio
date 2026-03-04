import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { conflictResponseSchema, createTemplateBodySchema, templateResponseSchema } from "../dto";

export const createTemplateRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/templates",
  description: "Create a new template for a project.",
  tags: ["Templates"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
    }),
    body: {
      content: { "application/json": { schema: createTemplateBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Template created.",
      content: { "application/json": { schema: templateResponseSchema } },
    },
    409: {
      description: "Template already exists.",
      content: { "application/json": { schema: conflictResponseSchema } },
    },
  },
});

export const createTemplateHandler = (deps: RouteDeps): AppRouteHandler<typeof createTemplateRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const { name, template_type, content, is_default } = c.req.valid("json");

    const existing = await deps.templatesService.getByName(projectId, name);
    if (existing) {
      return c.json({ error: `Template already exists: ${name}` }, 409);
    }

    const file = await deps.filesService.upload({
      project_id: projectId,
      file_name: `${name}.md`,
      file_kind: "template",
      data: Buffer.from(content),
      mime_type: "text/markdown",
    });

    const template = await deps.templatesService.create({
      project_id: projectId,
      name,
      template_type,
      file_id: file.id,
      is_default,
    });

    deps.eventBus.emit("templates", "set", template);

    return c.json(template, 201);
  };
};
