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

const createNotFoundResponse = (id: string) => ({ error: `Workspace not found: ${id}` }) as const;

const createMissingStatusResponse = (status: string) => ({ error: `Attempt status not found: "${status}"` }) as const;

const createHookRejectedResponse = (stdout?: string, stderr?: string) => ({
  error: "Pre-hook rejected the transition",
  hook_output: [stdout, stderr].filter(Boolean).join("\n").trim(),
});

const resolveFromStatusName = async (deps: RouteDeps, attemptStatusId: string | null) => {
  if (!attemptStatusId) {
    return null;
  }

  const fromStatus = await deps.attemptStatusService.get(attemptStatusId);
  return fromStatus?.name ?? null;
};

const resolveTransitionSession = async (deps: RouteDeps, projectId: string, sessionId?: string) => {
  if (!sessionId) {
    return undefined;
  }

  const session = await deps.sessionService.get(sessionId);
  if (!session || session.project_id !== projectId) {
    return undefined;
  }

  return session;
};

const resolveTicketShorthand = async (deps: RouteDeps, workspaceId: string) => {
  const ticketLink = await deps.workspaceService.getTicketWorkspaceLink(workspaceId);
  if (!ticketLink) {
    return undefined;
  }

  const ticket = await deps.ticketService.get(ticketLink.ticket_id);
  return ticket?.shorthand;
};

const buildHookPayload = async (
  deps: RouteDeps,
  workspace: Awaited<ReturnType<RouteDeps["workspaceService"]["get"]>>,
  status: string,
  fromStatusName: string | null,
  sessionId?: string,
) => {
  const [ticketShorthand, session] = await Promise.all([
    resolveTicketShorthand(deps, workspace.id),
    resolveTransitionSession(deps, workspace.project_id, sessionId),
  ]);

  return {
    workspace_id: workspace.id,
    workspace: workspace.workspace_shorthand,
    ticket: ticketShorthand,
    project_id: workspace.project_id,
    worktree_path: workspace.worktree_path ?? undefined,
    branch: workspace.branch ?? undefined,
    attempt_status_from: fromStatusName ?? "",
    attempt_status_to: status,
    ...(sessionId && { session_id: sessionId }),
    ...(session?.original_session_id && { original_session_id: session.original_session_id }),
  };
};

const queueOrFirePostHook = (
  deps: RouteDeps,
  {
    fromStatusName,
    payload,
    projectId,
    sessionId,
    status,
    statusChangeId,
  }: {
    fromStatusName: string | null;
    payload: Record<string, string | undefined>;
    projectId: string;
    sessionId?: string;
    status: string;
    statusChangeId: string;
  },
) => {
  const postHookPayload = { ...payload, status_change_id: statusChangeId };

  if (sessionId) {
    deps.postHookStore.queue(sessionId, {
      hookName: `post-attempt-status-${status}`,
      statusChangeId,
      projectId,
      fromStatus: fromStatusName ?? "",
      toStatus: status,
      payload: postHookPayload,
    });
    return;
  }

  void firePostAttemptStatusHook(
    { repoService: deps.repoService },
    {
      projectId,
      toStatus: status,
      payload: postHookPayload,
    },
  ).catch(() => {});
};

export const updateAttemptStatusHandler = (deps: RouteDeps): AppRouteHandler<typeof updateAttemptStatusRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { status, session_id: sessionId } = c.req.valid("json");

    const workspace = await deps.workspaceService.get(id);
    if (!workspace) {
      return c.json(createNotFoundResponse(id), 404);
    }

    const toAttemptStatus = await deps.attemptStatusService.getByName(workspace.project_id, status);
    if (!toAttemptStatus) {
      return c.json(createMissingStatusResponse(status), 404);
    }

    const fromStatusName = await resolveFromStatusName(deps, workspace.attempt_status_id);
    const payload = await buildHookPayload(deps, workspace, status, fromStatusName, sessionId);
    const preResult = await firePreAttemptStatusHook(
      { repoService: deps.repoService },
      { projectId: workspace.project_id, fromStatus: fromStatusName ?? "", toStatus: status, payload },
    );

    if (preResult.rejected) {
      return c.json(createHookRejectedResponse(preResult.stdout, preResult.stderr), 422);
    }

    const updated = (await deps.workspaceService.updateAttemptStatus(id, toAttemptStatus.id))!;
    const statusChangeId = randomUUID();

    queueOrFirePostHook(deps, {
      fromStatusName,
      payload,
      projectId: workspace.project_id,
      sessionId,
      status,
      statusChangeId,
    });

    return c.json(
      {
        id: updated.id,
        attempt_status_id: updated.attempt_status_id,
        from_status: fromStatusName,
        to_status: status,
        status_change_id: statusChangeId,
      },
      200,
    );
  };
};
