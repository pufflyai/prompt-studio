import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { createStatusBodySchema, statusResponseSchema } from "../dto";

export const createStatusRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/statuses",
  description: "Create a new ticket status.",
  tags: ["Statuses"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: createStatusBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Status created.",
      content: { "application/json": { schema: statusResponseSchema } },
    },
  },
});

export const createStatusHandler = (deps: RouteDeps): AppRouteHandler<typeof createStatusRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    const row = await deps.statusesService.create({ project_id: projectId, ...body });

    deps.eventBus.emit("ticket_statuses", "set", row);

    const result = { ...row, column_actions: JSON.parse(row.column_actions) as string[] };
    return c.json(result, 201);
  };
};
