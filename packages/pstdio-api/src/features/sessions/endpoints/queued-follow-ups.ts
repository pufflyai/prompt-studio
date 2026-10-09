import { createRoute, z } from "@hono/zod-openapi";
import { queuedFollowUpUpdateResponseSchema, updateQueuedFollowUpInputSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import { HarnessParamError } from "../harness-params";
import { QueuedRequestConflict, updateQueuedRequest } from "../queued-request-operations";
import { SessionAttachmentError } from "../session-attachments";
import { withSchedulingLock } from "../session-scheduler-internals";

export const queuedFollowUpParamsSchema = z
  .object({ id: z.string(), queuePosition: z.coerce.number().int().positive() })
  .strict();
const okSchema = z.object({ ok: z.literal(true) });
const moveSchema = okSchema.extend({ queuePosition: z.number().int().positive() });
export const queueErrorResponses = {
  404: {
    description: "Queued request not found.",
    content: { "application/json": { schema: notFoundResponseSchema } },
  },
  409: {
    description: "Queued request changed or is being consumed.",
    content: { "application/json": { schema: notFoundResponseSchema } },
  },
  400: { description: "Invalid queued request.", content: { "application/json": { schema: notFoundResponseSchema } } },
};
const requestParams = { query: z.object({}).strict(), params: queuedFollowUpParamsSchema };

export const updateQueuedFollowUpRoute = createRoute({
  method: "patch",
  path: "/sessions/{id}/queued-follow-ups/{queuePosition}",
  tags: ["Sessions"],
  description: "Update a pending queued request without sending input.",
  request: { ...requestParams, body: { content: { "application/json": { schema: updateQueuedFollowUpInputSchema } } } },
  responses: {
    200: {
      description: "Queued request updated.",
      content: { "application/json": { schema: queuedFollowUpUpdateResponseSchema } },
    },
    ...queueErrorResponses,
  },
});
export const deleteQueuedFollowUpRoute = createRoute({
  method: "delete",
  path: "/sessions/{id}/queued-follow-ups/{queuePosition}",
  tags: ["Sessions"],
  request: { ...requestParams, query: z.object({ expectedRevision: z.string().optional() }).strict() },
  responses: {
    200: { description: "Queued request deleted.", content: { "application/json": { schema: okSchema } } },
    ...queueErrorResponses,
  },
});
export const moveQueuedFollowUpRoute = createRoute({
  method: "post",
  path: "/sessions/{id}/queued-follow-ups/{queuePosition}/move",
  tags: ["Sessions"],
  request: {
    ...requestParams,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            direction: z.enum(["up", "down"]),
            expectedRevision: z.string().optional(),
            steps: z.number().int().positive().default(1),
            expectedOrder: z
              .array(z.object({ queuePosition: z.number().int().positive(), revision: z.string() }))
              .optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Queued request moved.", content: { "application/json": { schema: moveSchema } } },
    ...queueErrorResponses,
  },
});

export const updateQueuedFollowUpHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof updateQueuedFollowUpRoute> =>
  async (c) => {
    const { id, queuePosition } = c.req.valid("param");
    const input = c.req.valid("json");
    const session = await deps.sessionService.get(id);
    if (!session) return c.json({ error: `Session not found: ${id}` }, 404);
    try {
      return c.json({ ok: true as const, request: await updateQueuedRequest(deps, id, queuePosition, input) }, 200);
    } catch (error) {
      if (error instanceof QueuedRequestConflict) return c.json({ error: error.message }, 409);
      if (error instanceof HarnessParamError || error instanceof SessionAttachmentError)
        return c.json({ error: error.message }, 400);
      throw error;
    }
  };

export const deleteQueuedFollowUpHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof deleteQueuedFollowUpRoute> =>
  async (c) => {
    const { id, queuePosition } = c.req.valid("param");
    return withSchedulingLock(async () => {
      const entry = await deps.sessionQueueEntriesService.get(queuePosition);
      if (!entry || entry.session_id !== id) return c.json({ error: "Queued request not found." }, 404);
      if (!(await deps.sessionQueueEntriesService.removePending(queuePosition, c.req.valid("query").expectedRevision)))
        return c.json({ error: "Queued request is being consumed." }, 409);
      return c.json({ ok: true as const }, 200);
    });
  };

export const moveQueuedFollowUpHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof moveQueuedFollowUpRoute> =>
  async (c) => {
    const { id, queuePosition } = c.req.valid("param");
    const input = c.req.valid("json");
    return withSchedulingLock(async () => {
      const moved = await deps.sessionQueueEntriesService.movePending({ sessionId: id, queuePosition, ...input });
      if (!moved) return c.json({ error: "The queue changed. Refresh before moving this request." }, 409);
      return c.json({ ok: true as const, queuePosition: moved.queuePosition }, 200);
    });
  };
