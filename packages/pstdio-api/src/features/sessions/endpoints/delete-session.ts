import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";

export const deleteSessionRoute = createRoute({
  method: "delete",
  path: "/sessions/{id}",
  description: "Permanently delete an inactive session. Workspace files and native agent history are kept.",
  tags: ["Sessions"],
  request: { params: z.object({ id: z.string() }).strict(), query: z.object({}).strict() },
  responses: {
    204: { description: "Session deleted." },
    404: { description: "Session not found.", content: { "application/json": { schema: notFoundResponseSchema } } },
    409: {
      description: "Session has active or queued work.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});
export const deleteSessionHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof deleteSessionRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    const result = await deps.sessionService.remove(id, deps.fileService);
    if (result.status === "missing") return c.json({ error: `Session not found: ${id}` }, 404);
    if (result.status === "busy") return c.json({ error: "Stop active or queued work before deleting." }, 409);
    return c.body(null, 204);
  };
