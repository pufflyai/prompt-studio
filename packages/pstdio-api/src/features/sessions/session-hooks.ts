import type { HookPayload, SessionHookName } from "pstdio-wt";
import type { createAttemptStatusService } from "../../services/attempt-status-service";
import type { createRepoService } from "../../services/repo-service";
import type { createWorkspaceSessionService } from "../../services/workspace-session-service";
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
  original_session_id?: string | null;
};

export type SessionHookDeps = {
  reposService: ReturnType<typeof createRepoService>;
  workspaceSessionsService: ReturnType<typeof createWorkspaceSessionService>;
  attemptStatusesService?: ReturnType<typeof createAttemptStatusService>;
};

const parseTicketShorthand = (workspaceShorthand: string) => {
  const match = workspaceShorthand.match(/^(.+)_A\d+$/);
  return match?.[1] ?? undefined;
};

const resolveAttemptStatusName = async (
  deps: { attemptStatusesService: ReturnType<typeof createAttemptStatusService> },
  projectId: string,
  attemptStatusId: string | null,
) => {
  if (!attemptStatusId) return undefined;
  const statuses = await deps.attemptStatusesService.list(projectId);
  return statuses.find((s) => s.id === attemptStatusId)?.name;
};

const resolveSessionPayload = async (deps: SessionHookDeps, session: SessionRecord): Promise<HookPayload> => {
  const base: HookPayload = {
    session_id: session.id,
    session_status: session.status,
    project_id: session.project_id,
    ...(session.original_session_id && { original_session_id: session.original_session_id }),
  };

  const workspace = await deps.workspaceSessionsService.getWorkspaceBySessionId(session.id);
  if (!workspace) return base;

  const ticketShorthand =
    parseTicketShorthand(workspace.workspace_shorthand) ??
    (workspace as { ticket_shorthand?: string }).ticket_shorthand;

  let attemptStatus: string | undefined;
  if (deps.attemptStatusesService && workspace.attempt_status_id) {
    try {
      attemptStatus = await resolveAttemptStatusName(
        { attemptStatusesService: deps.attemptStatusesService },
        session.project_id,
        workspace.attempt_status_id,
      );
    } catch {
      // best-effort
    }
  }

  return {
    ...base,
    workspace: workspace.workspace_shorthand,
    workspace_id: workspace.id,
    worktree_path: workspace.worktree_path ?? undefined,
    branch: workspace.branch ?? undefined,
    ticket: ticketShorthand,
    ...(attemptStatus !== undefined && { attempt_status: attemptStatus }),
  };
};

const fireSessionHook = (deps: SessionHookDeps, hookName: SessionHookName, session: SessionRecord) => {
  void (async () => {
    let payload: HookPayload;
    try {
      payload = await resolveSessionPayload(deps, session);
    } catch {
      payload = { session_id: session.id, session_status: session.status };
    }

    await fireHook({ repoService: deps.reposService }, { hookName, projectId: session.project_id, payload });
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
