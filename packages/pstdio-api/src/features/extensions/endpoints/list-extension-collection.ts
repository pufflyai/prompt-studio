import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const extensionCollectionItemSchema = z.object({
  id: z.string(),
  value: z.any(),
});

const listExtensionCollectionResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      project_id: z.string(),
      extension_id: z.string(),
      scope_type: z.string(),
      scope_id: z.string(),
      collection: z.string(),
      item_id: z.string(),
      value_json: z.any(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  ),
});

const errorResponseSchema = z.object({ error: z.string() });

export const listExtensionCollectionRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/{extensionId}/collections/{collection}",
  description: "List extension collection items for a project.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        projectId: z.string(),
        extensionId: z.string(),
        collection: z.string(),
      })
      .strict(),
    query: z
      .object({
        scope_type: z.string().optional(),
        scope_id: z.string().optional(),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Extension collection items.",
      content: { "application/json": { schema: listExtensionCollectionResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const listExtensionCollectionHandler = (
  deps: RouteDeps,
): AppRouteHandler<typeof listExtensionCollectionRoute> => {
  return async (c) => {
    const { projectId, extensionId, collection } = c.req.valid("param");
    const { scope_type, scope_id } = c.req.valid("query");

    const project = await deps.projectService.get(projectId);
    if (!project) return c.json({ error: `Project not found: ${projectId}` }, 404);

    const items = await deps.extensionStorageService
      .collection({
        projectId,
        extensionId,
        collection,
        scopeType: scope_type,
        scopeId: scope_id,
      })
      .list();

    return c.json({ items }, 200);
  };
};

export type ExtensionCollectionItem = z.infer<typeof extensionCollectionItemSchema>;
