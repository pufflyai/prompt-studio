import { createRoute, z } from "@hono/zod-openapi";
import type { RouteDeps } from "../../deps";
import { approveBodySchema, notFoundResponseSchema } from "../dto";

export const approveSessionRoute = createRoute({
  method: "post",
  path: "/sessions/{id}/approve",
  description: "Respond to a tool approval request.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    params: z.object({ id: z.string() }).strict(),
    body: {
      content: { "application/json": { schema: approveBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Approval response sent.",
      content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
    },
    404: {
      description: "Session not found or no active session.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const approveSessionHandler = (deps: RouteDeps) => {
  return async (c: any) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const session = await deps.sessionsService.get(id);
    if (!session) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    const entry = deps.sessionStore.get(id);
    if (!entry) {
      return c.json({ error: `No active session process for: ${id}` }, 404);
    }

    // The approveBodySchema has { decision: "approve" | "deny" }
    // The ApprovalService needs { id, decision } where id is the approval request id
    // For now, resolve the most recent pending approval
    entry.approvalService.handleResponse({ id: input.id, decision: input.decision });

    if (input.decision === "approve" && session.status === "awaiting_input") {
      const updated = await deps.sessionsService.updateStatus(id, "in_progress");
      deps.eventBus.emit("sessions", "set", updated);
    }

    return c.json({ ok: true }, 200);
  };
};
