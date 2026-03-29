import type { SessionHookName } from "pstdio-wt";
import type { RouteDeps } from "../deps";
import { fireHook } from "../hooks/fire-hook";

type SessionStatus = "in_progress" | "awaiting_input" | "completed" | "failed" | "cancelled";

const STATUS_TO_HOOK: Partial<Record<SessionStatus, SessionHookName>> = {
  completed: "post-session-success",
  failed: "post-session-fail",
  awaiting_input: "post-session-await-input",
};

type SessionRecord = {
  id: string;
  project_id: string;
  status: string;
};

type SessionHookDeps = Pick<RouteDeps, "reposService" | "workspaceSessionsService"> &
  Partial<Pick<RouteDeps, "workspacesService" | "attemptStatusesService">>;

type SessionPayloadDeps = Pick<RouteDeps, "workspacesService" | "attemptStatusesService">;

type AttemptStatusRecord = Awaited<ReturnType<RouteDeps["attemptStatusesService"]["list"]>>[number];

const parseTicketShorthand = (workspaceShorthand: string) => {
  const match = workspaceShorthand.match(/^(.+)_A\d+$/);
  return match?.[1] ?? undefined;
};

const resolveWorkspaceContext = async (deps: SessionHookDeps, sessionId: string) => {
  const workspace = await deps.workspaceSessionsService.getWorkspaceBySessionId(sessionId);
  if (!workspace) return undefined;

  return {
    id: workspace.id,
    workspace: workspace.workspace_shorthand,
    ticketShorthand: parseTicketShorthand(workspace.workspace_shorthand),
    worktreePath: workspace.worktree_path ?? undefined,
    branch: workspace.branch ?? undefined,
    attemptStatusId: workspace.attempt_status_id ?? null,
  };
};

const buildAttemptStatusNameById = (attemptStatuses: AttemptStatusRecord[]) =>
  new Map(attemptStatuses.map((status) => [status.id, status.name]));

const resolveAttemptStatus = (workspace: { attempt_status_id: string | null }, statusById: Map<string, string>) => {
  if (!workspace.attempt_status_id) return null;
  return statusById.get(workspace.attempt_status_id) ?? null;
};

const resolveSessionPayload = async (
  deps: SessionPayloadDeps,
  session: SessionRecord,
  workspaceContext: Awaited<ReturnType<typeof resolveWorkspaceContext>>,
) => {
  const payload = { session: { id: session.id, status: session.status } };
  if (!workspaceContext) return { payload, ticketShorthand: undefined };

  const [workspaces, attemptStatuses] = await Promise.all([
    deps.workspacesService.list(session.project_id),
    deps.attemptStatusesService.list(session.project_id),
  ]);

  const currentWorkspace = workspaces.find((workspace) => workspace.id === workspaceContext.id);
  const ticketShorthand = currentWorkspace?.ticket_shorthand ?? workspaceContext.ticketShorthand;
  if (!ticketShorthand) return { payload, ticketShorthand: workspaceContext.ticketShorthand };

  const statusById = buildAttemptStatusNameById(attemptStatuses);

  const attempts = workspaces
    .filter((workspace) => workspace.ticket_shorthand === ticketShorthand)
    .map((workspace) => ({
      id: workspace.workspace_shorthand,
      status: resolveAttemptStatus(workspace, statusById),
    }));

  const fallbackCurrentAttempt = {
    id: workspaceContext.workspace,
    status: resolveAttemptStatus({ attempt_status_id: workspaceContext.attemptStatusId }, statusById),
  };

  const currentAttempt =
    attempts.find((attempt) => attempt.id === workspaceContext.workspace) ?? fallbackCurrentAttempt;
  const ticketAttempts = attempts.some((attempt) => attempt.id === currentAttempt.id)
    ? attempts
    : [...attempts, currentAttempt];

  return {
    payload: {
      ...payload,
      attempt: currentAttempt,
      ticket: {
        id: ticketShorthand,
        attempts: ticketAttempts,
      },
    },
    ticketShorthand,
  };
};

const canResolveSessionPayload = (deps: SessionHookDeps): deps is SessionHookDeps & SessionPayloadDeps =>
  Boolean(deps.workspacesService && deps.attemptStatusesService);

const fireSessionHook = (deps: SessionHookDeps, hookName: SessionHookName, session: SessionRecord) => {
  void (async () => {
    const context = await resolveWorkspaceContext(deps, session.id);
    const basePayload = { session: { id: session.id, status: session.status } };
    let payload: Record<string, unknown> = basePayload;
    let ticketShorthand = context?.ticketShorthand;

    if (context && canResolveSessionPayload(deps)) {
      try {
        const resolved = await resolveSessionPayload(deps, session, context);
        payload = resolved.payload;
        ticketShorthand = resolved.ticketShorthand ?? ticketShorthand;
      } catch {
        payload = basePayload;
      }
    }

    await fireHook(deps, {
      hookName,
      projectId: session.project_id,
      payload,
      context: context
        ? {
            workspace: context.workspace,
            ticketShorthand,
            worktreePath: context.worktreePath,
            branch: context.branch,
          }
        : undefined,
    });
  })().catch(() => {});
};

export const fireSessionStatusHook = (deps: SessionHookDeps, session: SessionRecord) => {
  const hookName = STATUS_TO_HOOK[session.status as SessionStatus];
  if (!hookName) return;
  fireSessionHook(deps, hookName, session);
};

export const fireSessionStartHook = (deps: SessionHookDeps, session: SessionRecord) => {
  fireSessionHook(deps, "post-session-start", session);
};

export const fireSessionResumeHook = (deps: SessionHookDeps, session: SessionRecord) => {
  fireSessionHook(deps, "post-session-resume", session);
};
