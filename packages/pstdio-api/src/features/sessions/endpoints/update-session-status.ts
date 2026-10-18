import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { buildDiff, emitActivityEvent } from "../../activity/activity-events";
import type { SessionsRouteDeps } from "../deps";
import { notFoundResponseSchema, sessionResponseSchema } from "../dto";
import { toSessionResponse } from "../session-response";

export const updateSessionStatusRoute = createRoute({
  method: "patch",
  path: "/sessions/{id}/status",
  description: "Update session status.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Session ID" }),
      })
      .strict(),
    body: {
      content: {
        "application/json": {
          schema: z
            .object({
              status: z.enum(["in_progress", "awaiting_input", "completed", "failed", "cancelled", "disconnected"]),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Session status updated.",
      content: { "application/json": { schema: sessionResponseSchema } },
    },
    404: {
      description: "Session not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const updateSessionStatusHandler = (
  deps: SessionsRouteDeps,
): AppRouteHandler<typeof updateSessionStatusRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const existing = await deps.sessionService.get(id);
    if (!existing) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }
    if (existing.status === status) {
      const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(existing.id);
      return c.json(
        toSessionResponse(existing, workspace?.project_id === existing.project_id ? workspace.id : null),
        200,
      );
    }

    const updated =
      status === "cancelled"
        ? await deps.sessionService.cancel(id)
        : await deps.sessionService.transitionStatus(id, status);
    if (!updated) {
      return c.json({ error: `Session not found: ${id}` }, 404);
    }

    if (updated.project_id) {
      await emitActivityEvent(deps, {
        projectId: updated.project_id,
        resourceType: "session",
        resourceId: updated.id,
        eventType: "session_status_updated",
        summary: `Updated status for session ${updated.title}`,
        payload: {
          status: buildDiff(existing.status, updated.status),
          to_status: updated.status,
        },
      });
    }

    const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(updated.id);
    return c.json(toSessionResponse(updated, workspace?.project_id === updated.project_id ? workspace.id : null), 200);
  };
};
