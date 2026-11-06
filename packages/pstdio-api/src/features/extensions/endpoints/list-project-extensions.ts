import { createRoute, z } from "@hono/zod-openapi";
import { listProjectExtensionsResponseSchema } from "pstdio-api-contracts";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { listProjectExtensionInventory } from "../project-extension-inventory";

const errorSchema = z.object({ error: z.string() });

export const listProjectExtensionsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions",
  description: "List every extension instance attached to a project, including disabled ones.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string().openapi({ description: "Project ID" }) }).strict(),
  },
  responses: {
    200: {
      description: "Project extension instances.",
      content: { "application/json": { schema: listProjectExtensionsResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const listProjectExtensionsHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof listProjectExtensionsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    try {
      return c.json(await listProjectExtensionInventory(deps, projectId), 200);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };
};
