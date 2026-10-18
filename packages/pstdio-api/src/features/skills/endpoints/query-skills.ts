import { createRoute, z } from "@hono/zod-openapi";
import { pageQuerySchema } from "pstdio-api-contracts";
import { ExtensionCatalogAssetError } from "../../../services/extension-asset-catalog";
import type { AppRouteHandler } from "../../../types";
import type { SkillsRouteDeps } from "../deps";
import { badRequestResponseSchema, skillResponseSchema, toSkillResponse } from "../dto";

export const querySkillsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/skills/query",
  tags: ["Skills"],
  description: "Query resolved skills by immutable ID. File content is loaded for this page only.",
  request: { params: z.object({ projectId: z.string() }), query: pageQuerySchema.strict() },
  responses: {
    200: {
      description: "One skill page",
      content: {
        "application/json": {
          schema: z.object({ items: z.array(skillResponseSchema), nextCursor: z.string().nullable() }),
        },
      },
    },
    400: {
      description: "Skill source unavailable",
      content: { "application/json": { schema: badRequestResponseSchema } },
    },
  },
});
export const querySkillsHandler = (deps: SkillsRouteDeps) => {
  const handler: AppRouteHandler<typeof querySkillsRoute> = async (c) => {
    try {
      const page = await deps.skillService.query(c.req.valid("param").projectId, c.req.valid("query"));
      return c.json({ ...page, items: page.items.map(toSkillResponse) }, 200);
    } catch (error) {
      if (error instanceof ExtensionCatalogAssetError) return c.json({ error: error.message }, 400);
      throw error;
    }
  };
  return handler;
};
