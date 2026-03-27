import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const attemptStatusBodySchema = z
  .object({
    status: z.string().openapi({ description: "Attempt status name" }),
  })
  .strict();

const attemptStatusResponseSchema = z.object({
  id: z.string(),
  attempt_status_id: z.string().nullable(),
});

const errorSchema = z.object({ error: z.string() });

export const updateAttemptStatusRoute = createRoute({
  method: "patch",
  path: "/workspaces/{id}/attempt-status",
  description: "Update the attempt status for a workspace.",
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
      description: "Workspace or status not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const updateAttemptStatusHandler = (deps: RouteDeps): AppRouteHandler<typeof updateAttemptStatusRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");

    const workspace = await deps.workspacesService.get(id);
    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    const attemptStatus = await deps.attemptStatusesService.getByName(workspace.project_id, status);
    if (!attemptStatus) {
      return c.json({ error: `Attempt status not found: "${status}"` }, 404);
    }

    const updated = await deps.workspacesService.updateAttemptStatusId(id, attemptStatus.id);

    deps.eventBus.emit("workspaces", "set", updated);
    return c.json({ id: updated!.id, attempt_status_id: updated!.attempt_status_id }, 200);
  };
};
