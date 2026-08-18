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
          .enum(["in_progress", "awaiting_input", "queued", "completed", "failed", "cancelled", "disconnected"])
          .optional()
          .openapi({ description: "Filter by status" }),
        agent: z.string().optional().openapi({ description: "Filter by agent" }),
        workspace_id: z.string().optional().openapi({ description: "Filter by linked workspace" }),
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

    const sessions = query.workspace_id
      ? (await deps.workspaceSessionService.listByWorkspace(query.workspace_id)).filter(
          (session) =>
            session.project_id === query.project_id &&
            (!query.status || session.status === query.status) &&
            (!query.agent || session.agent === query.agent) &&
            (query.archived === "true" || !session.archived),
        )
      : await deps.sessionService.list(query.project_id, {
          status: query.status,
          agent: query.agent,
          includeArchived: query.archived === "true",
        });

    return c.json(sessions, 200);
  };
};
