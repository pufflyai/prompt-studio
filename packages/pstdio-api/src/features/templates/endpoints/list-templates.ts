import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { templateResponseSchema } from "../dto";
import { listTemplateRegistry } from "../registry/list-registry";

export const listTemplatesRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/templates",
  description:
    "List all templates available to a project: enabled extension-provided defaults plus project-owned templates.",
  tags: ["Templates"],
  request: {
    query: z
      .object({
        type: z.string().optional(),
        sourceKind: z.enum(["project", "extension-default"]).optional(),
        includeDisabled: z.enum(["true", "false"]).optional(),
      })
      .strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "List of templates (merged registry).",
      content: { "application/json": { schema: z.array(templateResponseSchema) } },
    },
  },
});

export const listTemplatesHandler = (deps: RouteDeps): AppRouteHandler<typeof listTemplatesRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const { type, sourceKind, includeDisabled } = c.req.valid("query");
    const templates = await listTemplateRegistry(deps, projectId, {
      type,
      includeDisabledExtensionDefaults: includeDisabled === "true",
    });
    const filtered = sourceKind ? templates.filter((template) => template.source_kind === sourceKind) : templates;
    return c.json(filtered, 200);
  };
};
