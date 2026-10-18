import { createRoute, z } from "@hono/zod-openapi";
import { boardViewSchema, pageQuerySchema } from "pstdio-api-contracts";
export const queryBoardViewsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/boards/{boardId}/views/query",
  tags: ["Board views"],
  description: "Query saved views in their configured order. Reordering between reads changes subsequent pages.",
  request: { params: z.object({ projectId: z.string(), boardId: z.string() }), query: pageQuerySchema.strict() },
  responses: {
    200: {
      description: "One saved-view page",
      content: {
        "application/json": {
          schema: z.object({ items: z.array(boardViewSchema), nextCursor: z.string().nullable() }),
        },
      },
    },
  },
});
