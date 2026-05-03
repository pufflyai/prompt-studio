import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import {
  badRequestResponseSchema,
  forbiddenResponseSchema,
  notFoundResponseSchema,
  templateResponseSchema,
  updateTemplateBodySchema,
} from "../dto";
import { isExtensionDefaultName } from "../registry/extension-default-names";
import { projectTemplateRowToTemplate } from "../registry/project-template-mapper";

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
    403: {
      description: "Template is a read-only extension default.",
      content: { "application/json": { schema: forbiddenResponseSchema } },
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

export const updateTemplateHandler = (deps: RouteDeps): AppRouteHandler<typeof updateTemplateRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await deps.templateService.getByName(projectId, name);
    if (!existing) {
      if (await isExtensionDefaultName(deps, name)) {
        return c.json(
          {
            error: `Template "${name}" is a read-only extension default. Copy it to create an editable project variation.`,
          },
          403,
        );
      }
      return c.json({ error: `Template not found: ${name}` }, 404);
    }

    const handleUpdateError = (error: "not_found" | "cannot_change_only_default_template_type") => {
      if (error === "cannot_change_only_default_template_type") {
        return c.json({ error: "Cannot change template_type for the only default template in its current type" }, 400);
      }

      return c.json({ error: `Template not found: ${name}` }, 404);
    };

    let updated = existing;

    if (body.is_default !== undefined || body.template_type !== undefined) {
      const metadataResult = await deps.templateService.update(projectId, name, {
        is_default: body.is_default,
        template_type: body.template_type,
      });

      if ("error" in metadataResult) {
        return handleUpdateError(metadataResult.error as "not_found" | "cannot_change_only_default_template_type");
      }

      updated = metadataResult.template;
    }

    if (body.content) {
      const file = await deps.fileService.update(updated.file_id, {
        data: Buffer.from(body.content),
      });

      if (file) {
        const fileResult = await deps.templateService.update(projectId, name, {
          file_id: file.id,
        });

        if ("error" in fileResult) {
          return handleUpdateError(fileResult.error as "not_found" | "cannot_change_only_default_template_type");
        }

        updated = fileResult.template;
      }
    }

    const response = projectTemplateRowToTemplate(updated);
    deps.eventBus.emit("templates", "set", response);

    return c.json(response, 200);
  };
};
