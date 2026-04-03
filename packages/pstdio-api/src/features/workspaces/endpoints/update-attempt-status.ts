import { randomUUID } from "node:crypto";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { firePostAttemptStatusHook, firePreAttemptStatusHook } from "../../hooks/attempt-status-hooks";

const attemptStatusBodySchema = z
  .object({
    status: z.string().openapi({ description: "Attempt status name" }),
    session_id: z.string().optional().openapi({ description: "Session requesting this transition" }),
  })
  .strict();

const attemptStatusResponseSchema = z.object({
  id: z.string(),
  attempt_status_id: z.string().nullable(),
  from_status: z.string().nullable(),
  to_status: z.string(),
  status_change_id: z.string(),
});

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
      description: "Pre-hook rejected the transition.",
      content: { "application/json": { schema: hookRejectedSchema } },
    },
  },
});

export const updateAttemptStatusHandler = (deps: RouteDeps): AppRouteHandler<typeof updateAttemptStatusRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { status, session_id: sessionId } = c.req.valid("json");

    const workspace = await deps.workspaceService.get(id);
    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    const toAttemptStatus = await deps.attemptStatusService.getByName(workspace.project_id, status);
    if (!toAttemptStatus) {
      return c.json({ error: `Attempt status not found: "${status}"` }, 404);
    }

    // Resolve "from" status name
    let fromStatusName: string | null = null;
    if (workspace.attempt_status_id) {
      const fromStatus = await deps.attemptStatusService.get(workspace.attempt_status_id);
      fromStatusName = fromStatus?.name ?? null;
    }

    const ticketLink = await deps.workspaceService.getTicketWorkspaceLink(workspace.id);
    const ticket = ticketLink ? await deps.ticketService.get(ticketLink.ticket_id) : null;
    const session = sessionId ? await deps.sessionService.get(sessionId) : null;
    const originalSessionId =
      session && session.project_id === workspace.project_id ? (session.original_session_id ?? undefined) : undefined;

    // Build payload for hooks
    const payload = {
      workspace_id: workspace.id,
      workspace: workspace.workspace_shorthand,
      ticket: ticket?.shorthand,
      project_id: workspace.project_id,
      worktree_path: workspace.worktree_path ?? undefined,
      branch: workspace.branch ?? undefined,
      attempt_status_from: fromStatusName ?? "",
      attempt_status_to: status,
      ...(sessionId && { session_id: sessionId }),
      ...(originalSessionId && { original_session_id: originalSessionId }),
    };

    // Run pre-hook
    const preResult = await firePreAttemptStatusHook(
      { repoService: deps.repoService },
      { projectId: workspace.project_id, fromStatus: fromStatusName ?? "", toStatus: status, payload },
    );

    if (preResult.rejected) {
      const hookOutput = [preResult.stdout, preResult.stderr].filter(Boolean).join("\n").trim();
      return c.json({ error: "Pre-hook rejected the transition", hook_output: hookOutput }, 422);
    }

    // Commit the transition
    const updated = await deps.workspaceService.updateAttemptStatus(id, toAttemptStatus.id);
    const statusChangeId = randomUUID();

    const postHookPayload = { ...payload, status_change_id: statusChangeId };

    // Queue post-hook for deferred delivery at session completion
    if (sessionId) {
      deps.postHookStore.queue(sessionId, {
        hookName: `post-attempt-status-${status}`,
        statusChangeId,
        projectId: workspace.project_id,
        fromStatus: fromStatusName ?? "",
        toStatus: status,
        payload: postHookPayload,
      });
    } else {
      void firePostAttemptStatusHook(
        { repoService: deps.repoService },
        {
          projectId: workspace.project_id,
          toStatus: status,
          payload: postHookPayload,
        },
      ).catch(() => {});
    }

    return c.json(
      {
        id: updated!.id,
        attempt_status_id: updated!.attempt_status_id,
        from_status: fromStatusName,
        to_status: status,
        status_change_id: statusChangeId,
      },
      200,
    );
  };
};
