import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { StatusesRouteDeps } from "../deps";
import { statusResponseSchema } from "../dto";

export const listStatusesRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/statuses",
  description: "List ticket statuses for a project.",
  deprecated: true,
  tags: ["Statuses"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "List of statuses.",
      content: { "application/json": { schema: z.array(statusResponseSchema) } },
    },
  },
});

export const listStatusesHandler = (deps: StatusesRouteDeps): AppRouteHandler<typeof listStatusesRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const rows = await deps.statusService.list(projectId);
    const statuses = rows.map((row) => ({
      ...row,
      column_actions: JSON.parse(row.column_actions) as string[],
    }));
    return c.json(statuses, 200);
  };
};
