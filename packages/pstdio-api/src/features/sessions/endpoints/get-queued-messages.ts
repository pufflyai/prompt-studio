import { createRoute, z } from "@hono/zod-openapi";
import { sessionQueuedMessagesResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import { getQueuedSessionMessages } from "../queued-session-messages";

export const getQueuedMessagesRoute = createRoute({
  method: "get",
  path: "/sessions/{id}/queued-messages",
  tags: ["Sessions"],
  description: "Get pending queued prompts without loading conversation history.",
  request: { params: z.object({ id: z.string() }).strict() },
  responses: {
    200: {
      description: "Pending queued prompts.",
      content: { "application/json": { schema: sessionQueuedMessagesResponseSchema } },
    },
    404: { description: "Session not found.", content: { "application/json": { schema: notFoundResponseSchema } } },
  },
});
export const getQueuedMessagesHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof getQueuedMessagesRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    const session = await deps.sessionService.get(id);
    if (!session) return c.json({ error: `Session not found: ${id}` }, 404);
    const messages = session.project_id ? await getQueuedSessionMessages(deps, session.project_id, id) : [];
    return c.json({ messages }, 200);
  };
