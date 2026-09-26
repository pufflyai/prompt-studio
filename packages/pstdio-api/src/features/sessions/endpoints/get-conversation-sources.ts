import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { sessionConversationSourcesSchema } from "pstdio-api-contracts";
import type { AppBindings } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import { readSessionHistorySources } from "../session-history";

export const getConversationSourcesRoute = createRoute({
  method: "get",
  path: "/sessions/{id}/conversation/sources",
  tags: ["Sessions"],
  description: "Read both conversation history sources without changing either source.",
  request: { params: z.object({ id: z.string() }).strict() },
  responses: {
    200: {
      description: "Conversation sources",
      content: { "application/json": { schema: sessionConversationSourcesSchema } },
    },
    404: { description: "Session not found", content: { "application/json": { schema: notFoundResponseSchema } } },
  },
});

export const getConversationSourcesHandler = (deps: SessionsRouteDeps) => async (c: Context<AppBindings>) => {
  const id = c.req.param("id")!;
  if (!(await deps.sessionService.get(id))) return c.json({ error: "Session not found" }, 404);
  return c.json((await readSessionHistorySources(id, deps)).sources, 200);
};
