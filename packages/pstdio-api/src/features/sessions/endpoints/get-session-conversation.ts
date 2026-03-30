import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppBindings } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, sessionConversationResponseSchema } from "../dto";
import { getSessionMessages } from "../get-session-messages";

export const getSessionConversationRoute = createRoute({
  method: "get",
  path: "/sessions/{id}/conversation",
  description: "Get a session and its full conversation.",
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
      description: "Session and conversation found.",
      content: { "application/json": { schema: sessionConversationResponseSchema } },
    },
    404: {
      description: "Session not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getSessionConversationHandler = (deps: RouteDeps) => {
  return async (c: Context<AppBindings>) => {
    const id = c.req.param("id")!;
    const session = await deps.sessionService.get(id);

    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    const messages = await getSessionMessages(id, deps);
    return c.json({ session, messages }, 200);
  };
};
