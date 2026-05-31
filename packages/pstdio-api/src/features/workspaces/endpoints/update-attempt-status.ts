import { createRoute, z } from "@hono/zod-openapi";
import {
  attemptStatusEvents,
  type ExtensionTicket,
  type ExtensionWorkspace,
  workspaceCommands,
} from "@pstdio/sdk/extensions";
import { updateAttemptStatusResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { fireExtensionEventAsync, runExtensionHostCommand } from "../../extensions/extension-event-runtime";
import { setWorkspaceAttemptStatus } from "../attempt-status-transition";
import type { WorkspacesRouteDeps } from "../deps";
import { parseTicketShorthand } from "../parse-ticket-shorthand";

const attemptStatusBodySchema = z
  .object({
    status: z.string().openapi({ description: "Attempt status name" }),
    session_id: z.string().optional().openapi({ description: "Session requesting this transition" }),
  })
  .strict();

const attemptStatusResponseSchema = updateAttemptStatusResponseSchema;

const middlewareRejectedSchema = z.object({ error: z.string(), middleware_output: z.string() });
const errorSchema = z.object({ error: z.string() });

export const updateAttemptStatusRoute = createRoute({
  method: "patch",
  path: "/workspaces/{id}/attempt-status",
  description: "Update the attempt status for a workspace.",
  deprecated: true,
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
      content: { "application/json": { schema: middlewareRejectedSchema } },
    },
  },
});

const notFoundResponse = (id: string) => ({ error: `Workspace not found: ${id}` }) as const;
const missingStatusResponse = (status: string) => ({ error: `Attempt status not found: "${status}"` }) as const;
const rejectedResponse = (reason: string) => ({
  error: "Middleware rejected the transition",
  middleware_output: reason,
});

type WorkspaceRecord = NonNullable<Awaited<ReturnType<WorkspacesRouteDeps["workspaceService"]["get"]>>>;

const resolveTicketStatusName = async (deps: WorkspacesRouteDeps, projectId: string, statusId: string | null) => {
  if (!statusId) return null;
  const statuses = await deps.statusService.list(projectId);
  return statuses.find((candidate) => candidate.id === statusId)?.name ?? null;
};

const resolveAttemptStatusEventPayload = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  input: { fromStatusName: string | null; sessionId?: string },
) => {
  const ticketShorthand =
    parseTicketShorthand(workspace.workspace_shorthand) ??
    (workspace as { ticket_shorthand?: string }).ticket_shorthand ??
    workspace.workspace_shorthand;
  const ticket = await deps.ticketService.getByShorthand(workspace.project_id, ticketShorthand);
  const ticketStatusName = ticket ? await resolveTicketStatusName(deps, workspace.project_id, ticket.status_id) : null;

  return {
    workspace: {
      ...workspace,
      ticket_shorthand: ticketShorthand,
      attempt_status_name: input.fromStatusName,
    },
    workspaceId: workspace.id,
    prompts: {},
    worktreePath: workspace.worktree_path ?? undefined,
    branch: workspace.branch ?? undefined,
    ...(ticket ? { ticket: { ...ticket, status_name: ticketStatusName } } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
  };
};

const resolveAttemptStatusEventContext = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  input: { status: string; sessionId?: string },
) => {
  const fromAttemptStatus = workspace.attempt_status_id
    ? await deps.attemptStatusService.get(workspace.attempt_status_id)
    : null;
  const fromStatusName = fromAttemptStatus?.name ?? null;

  if (fromStatusName === input.status) return { fromStatusName, payload: null };

  return {
    fromStatusName,
    payload: await resolveAttemptStatusEventPayload(deps, workspace, { fromStatusName, sessionId: input.sessionId }),
  };
};

const toWorkspaceEventPayload = (workspace: WorkspaceRecord) => {
  const { anchors_json: _anchors, ...payload } = workspace;
  return payload as ExtensionWorkspace;
};

const fireAttemptStatusChangedEvent = async (
  deps: WorkspacesRouteDeps,
  workspace: WorkspaceRecord,
  status: string,
  eventContext: Awaited<ReturnType<typeof resolveAttemptStatusEventContext>>,
  statusChangeId: string,
  sessionId?: string,
) => {
  if (!eventContext.payload) return;

  const session = sessionId ? await deps.sessionService.get(sessionId) : null;
  const payload = eventContext.payload as {
    ticket?: ExtensionTicket;
    workspace?: ExtensionWorkspace;
    worktreePath?: string;
  };

  fireExtensionEventAsync(deps, workspace.project_id, attemptStatusEvents.changed, {
    projectId: workspace.project_id,
    workspaceId: workspace.id,
    ticket: payload.ticket ?? null,
    fromStatus: eventContext.fromStatusName,
    toStatus: status,
    sessionId: sessionId ?? null,
    originalSessionId: session?.original_session_id ?? null,
    worktreePath: workspace.worktree_path ?? payload.worktreePath ?? null,
    workspace: {
      ...(payload.workspace ?? {}),
      ...toWorkspaceEventPayload(workspace),
      attempt_status_name: status,
    } as ExtensionWorkspace,
    statusChangeId,
  });
};

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

    const eventContext = await resolveAttemptStatusEventContext(deps, workspace, { status, sessionId });

    const outcome = await runExtensionHostCommand(
      deps,
      workspace.project_id,
      workspaceCommands.setAttemptStatus,
      {
        workspaceId: id,
        status,
        sessionId,
      },
      (invocation) => setWorkspaceAttemptStatus(deps, invocation.params).then((transition) => transition.result),
    );

    if (outcome.status === "rejected") return c.json(rejectedResponse(outcome.reason), 422);
    if (outcome.status === "error") throw new Error(outcome.reason);

    const updatedWorkspace = await deps.workspaceService.get(id);
    if (updatedWorkspace) {
      await fireAttemptStatusChangedEvent(
        deps,
        updatedWorkspace,
        status,
        eventContext,
        outcome.value.status_change_id,
        sessionId,
      );
    }

    return c.json(outcome.value, 200);
  };
};
