import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { TemplatesRouteDeps } from "../deps";
import {
  badRequestResponseSchema,
  notFoundResponseSchema,
  templateResponseSchema,
  updateTemplateBodySchema,
} from "../dto";

export const updateTemplateRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/templates/{name}",
  description: "Update a template's content, type, or default status.",
  tags: ["Templates"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z.string().openapi({ description: "Template name" }),
      })
      .strict(),
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
    400: {
      description: "Invalid template update request.",
      content: { "application/json": { schema: badRequestResponseSchema } },
    },
  },
});

export const updateTemplateHandler = (deps: TemplatesRouteDeps): AppRouteHandler<typeof updateTemplateRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const body = c.req.valid("json");

    const handleUpdateError = (
      error:
        | "asset_error"
        | "cannot_change_only_default_template_type"
        | "cannot_update_extension_template_type"
        | "not_found",
      message?: string,
    ) => {
      if (error === "asset_error") {
        return c.json({ error: message ?? "Extension template source asset could not be resolved" }, 400);
      }

      if (error === "cannot_change_only_default_template_type") {
        return c.json({ error: "Cannot change template_type for the only default template in its current type" }, 400);
      }

      if (error === "cannot_update_extension_template_type") {
        return c.json({ error: "Cannot change template_type for an extension-backed template" }, 400);
      }

      return c.json({ error: `Template not found: ${name}` }, 404);
    };

    const result = await deps.templateService.update(projectId, name, {
      content: body.content,
      enabled: body.enabled,
      is_default: body.is_default,
      template_type: body.template_type,
      title: body.title,
    });

    if ("error" in result) {
      return handleUpdateError(result.error, "message" in result ? result.message : undefined);
    }

    deps.eventBus.emit("templates", "set", result.template);

    return c.json(result.template, 200);
  };
};
