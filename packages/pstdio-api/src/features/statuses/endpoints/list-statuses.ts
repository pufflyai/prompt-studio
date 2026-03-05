import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { statusResponseSchema } from "../dto";

export const listStatusesRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/statuses",
  description: "List ticket statuses for a project.",
  tags: ["Statuses"],
  request: {
    params: z.object({
      projectId: z.string().openapi({ description: "Project ID" }),
    }),
  },
  responses: {
    200: {
      description: "List of statuses.",
      content: { "application/json": { schema: z.array(statusResponseSchema) } },
    },
  },
});

export const listStatusesHandler = (deps: RouteDeps): AppRouteHandler<typeof listStatusesRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const statuses = await deps.statusesService.list(projectId);
    return c.json(statuses, 200);
  };
};
