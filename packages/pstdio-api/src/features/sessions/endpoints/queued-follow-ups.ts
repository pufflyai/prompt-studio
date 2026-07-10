import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";

const queuedFollowUpParamsSchema = z
  .object({
    id: z.string(),
    queuePosition: z.coerce.number().int().positive(),
  })
  .strict();

const queuedFollowUpResponseSchema = z.object({ ok: z.literal(true) });

const queuedFollowUpMoveResponseSchema = queuedFollowUpResponseSchema.extend({
  queuePosition: z.number().int().positive(),
});

const queuedFollowUpEditBodySchema = z.object({
  prompt: z.string().trim().min(1),
});

const queuedFollowUpMoveBodySchema = z.object({
  direction: z.enum(["up", "down"]),
});

const okResponse = { ok: true } as const;

export const updateQueuedFollowUpRoute = createRoute({
  method: "patch",
  path: "/sessions/{id}/queued-follow-ups/{queuePosition}",
  description: "Update a pending queued follow-up prompt.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    params: queuedFollowUpParamsSchema,
    body: { content: { "application/json": { schema: queuedFollowUpEditBodySchema } } },
  },
  responses: {
    200: {
      description: "Queued follow-up updated.",
      content: { "application/json": { schema: queuedFollowUpResponseSchema } },
    },
    404: {
      description: "Queued follow-up not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const deleteQueuedFollowUpRoute = createRoute({
  method: "delete",
  path: "/sessions/{id}/queued-follow-ups/{queuePosition}",
  description: "Delete a pending queued follow-up.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    params: queuedFollowUpParamsSchema,
  },
  responses: {
    200: {
      description: "Queued follow-up deleted.",
      content: { "application/json": { schema: queuedFollowUpResponseSchema } },
    },
    404: {
      description: "Queued follow-up not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const moveQueuedFollowUpRoute = createRoute({
  method: "post",
  path: "/sessions/{id}/queued-follow-ups/{queuePosition}/move",
  description: "Move a pending queued follow-up one slot.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    params: queuedFollowUpParamsSchema,
    body: { content: { "application/json": { schema: queuedFollowUpMoveBodySchema } } },
  },
  responses: {
    200: {
      description: "Queued follow-up moved.",
      content: { "application/json": { schema: queuedFollowUpMoveResponseSchema } },
    },
    404: {
      description: "Queued follow-up not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

const getPendingQueueEntry = async (deps: SessionsRouteDeps, input: { sessionId: string; queuePosition: number }) => {
  const entries = await deps.sessionQueueEntriesService.listPendingBySession(input.sessionId);
  return entries.find((entry) => entry.queue_position === input.queuePosition) ?? null;
};

const queuePayload = (entry: NonNullable<Awaited<ReturnType<typeof getPendingQueueEntry>>>) => ({
  prompt: entry.prompt,
  request_kind: entry.request_kind,
  attachments_json: entry.attachments_json,
  question_response_json: entry.question_response_json,
  created_at: entry.created_at,
});

const updateEntryPrompt = async (
  deps: SessionsRouteDeps,
  input: { sessionId: string; queuePosition: number; prompt: string },
) => {
  const entry = await getPendingQueueEntry(deps, input);
  if (!entry) return false;

  await deps.sessionQueueEntriesService.updatePending(input.queuePosition, { prompt: input.prompt });
  return true;
};

const removeEntry = async (deps: SessionsRouteDeps, input: { sessionId: string; queuePosition: number }) => {
  const entry = await getPendingQueueEntry(deps, input);
  if (!entry) return false;

  await deps.sessionQueueEntriesService.remove(input.queuePosition);
  return true;
};

const moveEntry = async (
  deps: SessionsRouteDeps,
  input: { sessionId: string; queuePosition: number; direction: "up" | "down" },
) => {
  const entries = await deps.sessionQueueEntriesService.listPendingBySession(input.sessionId);
  const currentIndex = entries.findIndex((entry) => entry.queue_position === input.queuePosition);
  if (currentIndex === -1) return null;

  const targetIndex = input.direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= entries.length) return null;

  const current = entries[currentIndex]!;
  const target = entries[targetIndex]!;
  const swapped = await deps.sessionQueueEntriesService.swapPending(
    current.queue_position,
    queuePayload(target),
    target.queue_position,
    queuePayload(current),
  );
  return swapped ? target.queue_position : null;
};

const sessionExists = async (deps: SessionsRouteDeps, sessionId: string) =>
  Boolean(await deps.sessionService.get(sessionId));

export const updateQueuedFollowUpHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof updateQueuedFollowUpRoute> =>
  async (c) => {
    const { id, queuePosition } = c.req.valid("param");
    const { prompt } = c.req.valid("json");
    if (!(await sessionExists(deps, id))) return c.json({ error: `Session not found: ${id}` }, 404);

    const updated = await updateEntryPrompt(deps, { sessionId: id, queuePosition, prompt });
    if (!updated) return c.json({ error: `Queued follow-up not found: ${queuePosition}` }, 404);
    return c.json(okResponse, 200);
  };

export const deleteQueuedFollowUpHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof deleteQueuedFollowUpRoute> =>
  async (c) => {
    const { id, queuePosition } = c.req.valid("param");
    if (!(await sessionExists(deps, id))) return c.json({ error: `Session not found: ${id}` }, 404);

    const removed = await removeEntry(deps, { sessionId: id, queuePosition });
    if (!removed) return c.json({ error: `Queued follow-up not found: ${queuePosition}` }, 404);
    return c.json(okResponse, 200);
  };

export const moveQueuedFollowUpHandler =
  (deps: SessionsRouteDeps): AppRouteHandler<typeof moveQueuedFollowUpRoute> =>
  async (c) => {
    const { id, queuePosition } = c.req.valid("param");
    const { direction } = c.req.valid("json");
    if (!(await sessionExists(deps, id))) return c.json({ error: `Session not found: ${id}` }, 404);

    const movedQueuePosition = await moveEntry(deps, { sessionId: id, queuePosition, direction });
    if (movedQueuePosition === null) return c.json({ error: `Queued follow-up not found: ${queuePosition}` }, 404);
    return c.json({ ok: true as const, queuePosition: movedQueuePosition }, 200);
  };
