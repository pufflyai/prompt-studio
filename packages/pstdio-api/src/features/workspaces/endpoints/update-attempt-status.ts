import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const attemptStatusBodySchema = z
  .object({
    session_id: z.string().openapi({ description: "Session ID for the attempt" }),
    status: z.string().openapi({ description: "Attempt status name" }),
  })
  .strict();

const attemptStatusResponseSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  session_id: z.string(),
  attempt_status_id: z.string().nullable(),
  created_at: z.string(),
});

const errorSchema = z.object({ error: z.string() });

export const updateAttemptStatusRoute = createRoute({
  method: "patch",
  path: "/workspaces/{id}/attempt-status",
  description: "Update the attempt status for a workspace session.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string().openapi({ description: "Workspace ID" }) }).strict(),
    body: {
      content: { "application/json": { schema: attemptStatusBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Attempt status updated.",
      content: { "application/json": { schema: attemptStatusResponseSchema } },
    },
    404: {
      description: "Workspace, status, or session link not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const updateAttemptStatusHandler = (deps: RouteDeps): AppRouteHandler<typeof updateAttemptStatusRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { session_id, status } = c.req.valid("json");

    const workspace = await deps.workspacesService.get(id);
    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    const attemptStatus = await deps.attemptStatusesService.getByName(workspace.project_id, status);
    if (!attemptStatus) {
      return c.json({ error: `Attempt status not found: "${status}"` }, 404);
    }

    const updated = await deps.workspaceSessionsService.updateAttemptStatusId(id, session_id, attemptStatus.id);
    if (!updated) {
      return c.json({ error: `No session link found for workspace ${id} and session ${session_id}` }, 404);
    }

    deps.eventBus.emit("workspace_sessions", "set", updated);
    return c.json(updated, 200);
  };
};
