import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { notFoundResponseSchema, sessionResponseSchema } from "../dto";

export const renameSessionRoute = createRoute({
  method: "patch",
  path: "/sessions/{id}/title",
  description: "Rename a session.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    params: z.object({ id: z.string() }).strict(),
    body: { content: { "application/json": { schema: z.object({ title: z.string().trim().min(1) }).strict() } } },
  },
  responses: {
    200: { description: "Session renamed.", content: { "application/json": { schema: sessionResponseSchema } } },
    404: { description: "Session not found.", content: { "application/json": { schema: notFoundResponseSchema } } },
  },
});

export const renameSessionHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof renameSessionRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    const { title } = c.req.valid("json");
    const session = await deps.sessionService.update(id, { title });
    if (!session) return c.json({ error: `Session not found: ${id}` }, 404);
    return c.json(session, 200);
  };
