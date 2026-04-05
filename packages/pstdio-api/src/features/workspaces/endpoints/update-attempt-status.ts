import { randomUUID } from "node:crypto";
import { createRoute, z } from "@hono/zod-openapi";
import { updateAttemptStatusResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { firePostAttemptStatusHook, firePreAttemptStatusHook } from "../../hooks/attempt-status-hooks";
import { parseTicketShorthand } from "../parse-ticket-shorthand";

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

const resolveTicketStatusName = async (deps: RouteDeps, projectId: string, statusId: string | null) => {
  if (!statusId) {
    return null;
  }

  const statuses = await deps.statusService.list(projectId);
  return statuses.find((status) => status.id === statusId)?.name ?? null;
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

const resolveWorkspaceTicket = async (deps: RouteDeps, workspaceId: string) => {
  const ticketLink = await deps.workspaceService.getTicketWorkspaceLink(workspaceId);
  if (!ticketLink) {
    return null;
  }

  return deps.ticketService.get(ticketLink.ticket_id);
};

const buildHookPayload = async (
  deps: RouteDeps,
  input: {
    workspace: Awaited<ReturnType<RouteDeps["workspaceService"]["get"]>>;
    attemptStatusName: string | null;
    sessionId?: string;
  },
) => {
  const [ticket, session] = await Promise.all([
    resolveWorkspaceTicket(deps, input.workspace.id),
    resolveTransitionSession(deps, input.workspace.project_id, input.sessionId),
  ]);
  const ticketStatusName = ticket
    ? await resolveTicketStatusName(deps, input.workspace.project_id, ticket.status_id)
    : null;
  const ticketShorthand =
    ticket?.shorthand ??
    parseTicketShorthand(input.workspace.workspace_shorthand) ??
    input.workspace.workspace_shorthand;

  return {
    workspace: {
      ...input.workspace,
      ticket_shorthand: ticketShorthand,
      attempt_status_name: input.attemptStatusName,
    },
    workspaceId: input.workspace.id,
    ticket: ticket ? { ...ticket, status_name: ticketStatusName } : undefined,
    worktreePath: input.workspace.worktree_path ?? undefined,
    branch: input.workspace.branch ?? undefined,
    ...(input.sessionId && { sessionId: input.sessionId }),
    ...(session?.original_session_id && { originalSessionId: session.original_session_id }),
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
    payload: Record<string, unknown>;
    projectId: string;
    sessionId?: string;
    status: string;
    statusChangeId: string;
  },
) => {
  const postHookPayload = { ...payload, statusChangeId };

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
    { pluginService: deps.pluginService },
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
    const preHookPayload = await buildHookPayload(deps, {
      workspace,
      attemptStatusName: fromStatusName,
      sessionId,
    });
    const preResult = await firePreAttemptStatusHook(
      { pluginService: deps.pluginService },
      { projectId: workspace.project_id, fromStatus: fromStatusName ?? "", toStatus: status, payload: preHookPayload },
    );

    if (preResult.rejected) {
      return c.json(createHookRejectedResponse(preResult.stdout, preResult.stderr), 422);
    }

    const updated = (await deps.workspaceService.updateAttemptStatus(id, toAttemptStatus.id))!;
    const statusChangeId = randomUUID();
    const postHookPayload = await buildHookPayload(deps, {
      workspace: updated,
      attemptStatusName: status,
      sessionId,
    });

    queueOrFirePostHook(deps, {
      fromStatusName,
      payload: postHookPayload,
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
