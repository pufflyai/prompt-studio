import { createRoute, z } from "@hono/zod-openapi";
import type { RouteDeps } from "../../deps";
import { sessionResponseSchema } from "../dto";

export const listSessionsRoute = createRoute({
  method: "get",
  path: "/sessions",
  description: "List sessions for a project.",
  tags: ["Sessions"],
  request: {
    query: z.object({
      project_id: z.string().openapi({ description: "Project ID" }),
      status: z.string().optional().openapi({ description: "Filter by status" }),
      agent: z.string().optional().openapi({ description: "Filter by agent" }),
      archived: z.string().optional().openapi({ description: "Include archived" }),
    }),
  },
  responses: {
    200: {
      description: "List of sessions.",
      content: { "application/json": { schema: z.array(sessionResponseSchema) } },
    },
  },
});

export const listSessionsHandler = (deps: RouteDeps) => {
  return async (c: any) => {
    const query = c.req.valid("query");

    const sessions = await deps.sessionsService.list(query.project_id, {
      status: query.status as any,
      agent: query.agent,
      includeArchived: query.archived === "true",
    });

    return c.json(sessions, 200);
  };
};
