import { createRoute, z } from "@hono/zod-openapi";
import {
  combineQueuedFollowUpsInputSchema,
  pendingQueuedFollowUpsResponseSchema,
  queuedFollowUpUpdateResponseSchema,
} from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { pendingQueuedRequests } from "../pending-queued-requests";
import { combineQueuedRequests, QueuedRequestConflict } from "../queued-request-operations";
import { SessionAttachmentError } from "../session-attachments";
import { queuedFollowUpParamsSchema, queueErrorResponses } from "./queued-follow-ups";

export const pendingQueuedFollowUpsRoute = createRoute({
  method: "get",
  path: "/sessions/{id}/queued-follow-ups",
  tags: ["Sessions"],
  request: { params: z.object({ id: z.string() }).strict(), query: z.object({}).strict() },
  responses: {
    200: {
      description: "Complete pending queued requests.",
      content: { "application/json": { schema: pendingQueuedFollowUpsResponseSchema } },
    },
    ...queueErrorResponses,
  },
});
export const combineQueuedFollowUpsRoute = createRoute({
  method: "post",
  path: "/sessions/{id}/queued-follow-ups/{queuePosition}/combine",
  tags: ["Sessions"],
  request: {
    params: queuedFollowUpParamsSchema,
    query: z.object({}).strict(),
    body: { content: { "application/json": { schema: combineQueuedFollowUpsInputSchema } } },
  },
  responses: {
    200: {
      description: "Combined queued request.",
      content: { "application/json": { schema: queuedFollowUpUpdateResponseSchema } },
    },
    ...queueErrorResponses,
  },
});
export const pendingQueuedFollowUpsHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof pendingQueuedFollowUpsRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    if (!(await deps.sessionService.get(id))) return c.json({ error: "Session not found." }, 404);
    return c.json(await pendingQueuedRequests(deps, id), 200);
  };
export const combineQueuedFollowUpsHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof combineQueuedFollowUpsRoute> =>
  async (c) => {
    const { id, queuePosition } = c.req.valid("param");
    const input = c.req.valid("json");
    try {
      return c.json({ ok: true as const, request: await combineQueuedRequests(deps, id, queuePosition, input) }, 200);
    } catch (error) {
      if (error instanceof QueuedRequestConflict) return c.json({ error: error.message }, 409);
      if (error instanceof SessionAttachmentError) return c.json({ error: error.message }, 400);
      throw error;
    }
  };
