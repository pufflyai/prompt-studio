import { createRoute, z } from "@hono/zod-openapi";
import { copyExtensionTemplateInputSchema, templateSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { conflictResponseSchema, notFoundResponseSchema } from "../dto";
import { copyExtensionTemplate } from "../registry/copy-extension-template";

export const copyExtensionTemplateRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/templates/extension/{extensionId}/{templateKey}/copy",
  description: "Copy an extension template default into a project-owned editable template.",
  tags: ["Templates"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        extensionId: z.string().openapi({ description: "Extension ID" }),
        templateKey: z.string().openapi({ description: "Extension template key" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: copyExtensionTemplateInputSchema.strict().optional() } },
    },
  },
  responses: {
    201: {
      description: "Extension template copied to project-owned variation.",
      content: { "application/json": { schema: templateSchema } },
    },
    404: {
      description: "Extension template not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    409: {
      description: "Project template name conflict.",
      content: { "application/json": { schema: conflictResponseSchema } },
    },
    422: {
      description: "Extension template asset is unreadable.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const copyExtensionTemplateHandler =
  (deps: RouteDeps): AppRouteHandler<typeof copyExtensionTemplateRoute> =>
  async (c) => {
    const { projectId, extensionId, templateKey } = c.req.valid("param");
    const body = c.req.valid("json") ?? {};
    const result = await copyExtensionTemplate(deps, {
      projectId,
      extensionId,
      templateKey,
      name: body.name,
      isDefault: body.isDefault,
    });

    if (!result.ok) {
      if (result.error === "extension_template_not_found") {
        return c.json({ error: result.message }, 404);
      }
      if (result.error === "name_conflict") {
        return c.json({ error: result.message }, 409);
      }
      return c.json({ error: result.message }, 422);
    }

    return c.json(result.template, 201);
  };
