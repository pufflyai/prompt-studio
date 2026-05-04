import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { sessionResponseSchema } from "../dto";

export const listSessionsRoute = createRoute({
  method: "get",
  path: "/sessions",
  description: "List sessions for a project.",
  tags: ["Sessions"],
  request: {
    query: z
      .object({
        project_id: z.string().openapi({ description: "Project ID" }),
        status: z
          .enum(["in_progress", "awaiting_input", "completed", "failed", "cancelled", "disconnected"])
          .optional()
          .openapi({ description: "Filter by status" }),
        agent: z.string().optional().openapi({ description: "Filter by agent" }),
        archived: z.string().optional().openapi({ description: "Include archived" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "List of sessions.",
      content: { "application/json": { schema: z.array(sessionResponseSchema) } },
    },
  },
});

export const listSessionsHandler = (deps: SessionsRouteDeps): AppRouteHandler<typeof listSessionsRoute> => {
  return async (c) => {
    const query = c.req.valid("query");

    const sessions = await deps.sessionService.list(query.project_id, {
      status: query.status,
      agent: query.agent,
      includeArchived: query.archived === "true",
    });

    return c.json(sessions, 200);
  };
};
