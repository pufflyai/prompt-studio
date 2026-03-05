import { createRoute, z } from "@hono/zod-openapi";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, sessionResponseSchema } from "../dto";

export const getSessionRoute = createRoute({
  method: "get",
  path: "/sessions/{id}",
  description: "Get a session by ID.",
  tags: ["Sessions"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Session ID" }),
    }),
  },
  responses: {
    200: {
      description: "Session found.",
      content: { "application/json": { schema: sessionResponseSchema } },
    },
    404: {
      description: "Session not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getSessionHandler = (deps: RouteDeps) => {
  return async (c: any) => {
    const { id } = c.req.valid("param");
    const session = await deps.sessionsService.get(id);

    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    return c.json(session, 200);
  };
};
