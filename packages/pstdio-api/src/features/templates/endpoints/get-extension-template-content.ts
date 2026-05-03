import { createRoute, z } from "@hono/zod-openapi";
import { extensionTemplateContentSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";
import { findExtensionTemplate, readExtensionTemplateContent } from "../registry/extension-content";

export const getExtensionTemplateContentRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/templates/extension/{extensionId}/{templateKey}/content",
  description: "Read the read-only content of an extension-provided template default.",
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
  },
  responses: {
    200: {
      description: "Extension template content.",
      content: { "application/json": { schema: extensionTemplateContentSchema } },
    },
    404: {
      description: "Extension template not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    422: {
      description: "Extension template asset is unreadable.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getExtensionTemplateContentHandler =
  (deps: RouteDeps): AppRouteHandler<typeof getExtensionTemplateContentRoute> =>
  async (c) => {
    const { extensionId, templateKey } = c.req.valid("param");
    const resolved = await findExtensionTemplate(deps, extensionId, templateKey);
    if (!resolved) {
      return c.json({ error: `Extension template not found: ${extensionId}.${templateKey}` }, 404);
    }
    try {
      const content = await readExtensionTemplateContent(resolved);
      return c.json(
        {
          extensionId,
          templateKey,
          title: resolved.record.contribution.title,
          type: resolved.record.contribution.type,
          content,
        },
        200,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: `Cannot read extension template asset: ${message}` }, 422);
    }
  };
