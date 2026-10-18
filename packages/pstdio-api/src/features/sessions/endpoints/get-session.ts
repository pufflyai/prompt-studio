import { createRoute, z } from "@hono/zod-openapi";
import { extensionSessionSchema } from "pstdio-api-contracts";
import { readSessionExit } from "../../../services/session-exit";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { notFoundResponseSchema, sessionResponseSchema } from "../dto";
import { toSessionResponse } from "../session-response";

export const getSessionRoute = createRoute({
  method: "get",
  path: "/sessions/{id}",
  description: "Get a session by ID.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Session ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Session found.",
      content: { "application/json": { schema: sessionResponseSchema.extend(extensionSessionSchema.shape) } },
    },
    404: {
      description: "Session not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getSessionHandler = (deps: SessionsRouteDeps): AppRouteHandler<typeof getSessionRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const session = await deps.sessionService.get(id);

    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(id);
    const lastExit = session.project_id
      ? await readSessionExit(deps.activityEventsService, { ...session, project_id: session.project_id })
      : null;
    return c.json(
      {
        ...session,
        ...toSessionResponse(session, workspace?.project_id === session.project_id ? workspace.id : null),
        lastExit,
        last_exit: lastExit,
      },
      200,
    );
  };
};
