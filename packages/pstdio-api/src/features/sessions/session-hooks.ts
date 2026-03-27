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

type SessionHookDeps = Pick<RouteDeps, "reposService" | "workspaceSessionsService">;

const parseTicketShorthand = (workspaceShorthand: string) => {
  const match = workspaceShorthand.match(/^(.+)_A\d+$/);
  return match?.[1] ?? undefined;
};

const resolveWorkspaceContext = async (deps: SessionHookDeps, sessionId: string) => {
  const workspace = await deps.workspaceSessionsService.getWorkspaceBySessionId(sessionId);
  if (!workspace) return undefined;

  return {
    workspace: workspace.workspace_shorthand,
    ticketShorthand: parseTicketShorthand(workspace.workspace_shorthand),
    worktreePath: workspace.worktree_path ?? undefined,
    branch: workspace.branch ?? undefined,
  };
};

const fireSessionHook = (deps: SessionHookDeps, hookName: SessionHookName, session: SessionRecord) => {
  void (async () => {
    const context = await resolveWorkspaceContext(deps, session.id);
    await fireHook(deps, {
      hookName,
      projectId: session.project_id,
      payload: { session: { id: session.id, status: session.status } },
      context,
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
