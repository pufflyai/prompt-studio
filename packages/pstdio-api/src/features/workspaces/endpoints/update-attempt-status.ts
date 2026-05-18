import { createRoute, z } from "@hono/zod-openapi";
import { workspaceCommands } from "@pstdio/sdk/extensions";
import { updateAttemptStatusResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { runExtensionCommand } from "../../extensions/extension-event-runtime";
import type { WorkspacesRouteDeps } from "../deps";

const attemptStatusBodySchema = z
  .object({
    status: z.string().openapi({ description: "Attempt status name" }),
    session_id: z.string().optional().openapi({ description: "Session requesting this transition" }),
  })
  .strict();

const attemptStatusResponseSchema = updateAttemptStatusResponseSchema;

const hookRejectedSchema = z.object({ error: z.string(), hook_output: z.string() });
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
    422: {
      description: "Middleware rejected the transition.",
      content: { "application/json": { schema: hookRejectedSchema } },
    },
  },
});

const notFoundResponse = (id: string) => ({ error: `Workspace not found: ${id}` }) as const;
const missingStatusResponse = (status: string) => ({ error: `Attempt status not found: "${status}"` }) as const;
const rejectedResponse = (reason: string) => ({ error: "Rejected by middleware", hook_output: reason });

export const updateAttemptStatusHandler = (
  deps: WorkspacesRouteDeps,
): AppRouteHandler<typeof updateAttemptStatusRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { status, session_id: sessionId } = c.req.valid("json");

    const workspace = await deps.workspaceService.get(id);
    if (!workspace) return c.json(notFoundResponse(id), 404);

    const toAttemptStatus = await deps.attemptStatusService.getByName(workspace.project_id, status);
    if (!toAttemptStatus) return c.json(missingStatusResponse(status), 404);

    const outcome = await runExtensionCommand(deps, workspace.project_id, workspaceCommands.setAttemptStatus, {
      workspaceId: id,
      status,
      sessionId,
    });

    if (outcome.status === "rejected") return c.json(rejectedResponse(outcome.reason), 422);
    if (outcome.status === "error") throw new Error(outcome.reason);

    return c.json(outcome.value, 200);
  };
};
