import { createRoute, z } from "@hono/zod-openapi";
import { pageQuerySchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ProjectsRouteDeps } from "../deps";
import { projectResponseSchema, toProjectResponse } from "../dto";

export const queryProjectsRoute = createRoute({
  method: "get",
  path: "/projects/query",
  tags: ["Projects"],
  description: "Query active projects by immutable ID, with at most 200 items per page.",
  request: { query: pageQuerySchema.strict() },
  responses: {
    200: {
      description: "One project page",
      content: {
        "application/json": {
          schema: z.object({ items: z.array(projectResponseSchema), nextCursor: z.string().nullable() }),
        },
      },
    },
  },
});
export const queryProjectsHandler = (deps: ProjectsRouteDeps) => {
  const handler: AppRouteHandler<typeof queryProjectsRoute> = async (c) => {
    const page = await deps.projectService.query(c.req.valid("query"));
    return c.json({ items: page.rows.map(toProjectResponse), nextCursor: page.nextCursor }, 200);
  };
  return handler;
};
