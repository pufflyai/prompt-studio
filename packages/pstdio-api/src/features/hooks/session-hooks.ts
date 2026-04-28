import type { createAttemptStatusService } from "../../services/attempt-status-service";
import type { createRepoService } from "../../services/repo-service";
import type { createWorkspaceSessionService } from "../../services/workspace-session-service";
import type { createPluginService } from "../plugins/plugin-service";
import { parseTicketShorthand } from "../workspaces/parse-ticket-shorthand";
import { withHookSessionClient } from "./hook-client";

type SessionStatus = "in_progress" | "awaiting_input" | "completed" | "failed" | "cancelled" | "disconnected";

const STATUS_TO_HOOK: Partial<Record<SessionStatus, string>> = {
  completed: "postSessionSuccess",
  failed: "postSessionFail",
  awaiting_input: "postSessionAwaitInput",
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
  pluginService: ReturnType<typeof createPluginService>;
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

const resolveSessionHookContext = async (deps: SessionHookDeps, session: SessionRecord) => {
  const base = {
    projectId: session.project_id,
    sessionId: session.id,
    sessionStatus: session.status as SessionStatus,
    ...(session.original_session_id && { originalSessionId: session.original_session_id }),
  };

  const workspace = await deps.workspaceSessionsService.getWorkspaceBySessionId(session.id);
  if (!workspace) return base;

  const ticketAnchor =
    workspace.anchors_json.find(
      (anchor) => anchor.type === "pstdio.planner.ticket" || (anchor.type === "ticket" && anchor.extensionId),
    ) ?? null;
  const ticketShorthand =
    ticketAnchor?.label ?? ticketAnchor?.id ?? parseTicketShorthand(workspace.workspace_shorthand);

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

  const ticketShorthandForWorkspace =
    ticketShorthand ?? parseTicketShorthand(workspace.workspace_shorthand) ?? workspace.workspace_shorthand;

  return {
    ...base,
    workspace: {
      ...workspace,
      ticket_shorthand: ticketShorthandForWorkspace,
      attempt_status_name: attemptStatus ?? null,
    },
    workspaceId: workspace.id,
    worktreePath: workspace.worktree_path ?? undefined,
    branch: workspace.branch ?? undefined,
    ticket: ticketAnchor
      ? {
          id: ticketAnchor.id,
          shorthand: ticketShorthandForWorkspace,
          resource_ref: ticketAnchor,
        }
      : undefined,
    ...(attemptStatus !== undefined && { attemptStatus }),
  };
};

const WORKSPACE_READY_TIMEOUT_MS = 5_000;
const WORKSPACE_READY_POLL_MS = 25;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForWorkspaceReady = async (deps: SessionHookDeps, sessionId: string) => {
  let workspace = await deps.workspaceSessionsService.getWorkspaceBySessionId(sessionId);
  const deadline = Date.now() + WORKSPACE_READY_TIMEOUT_MS;

  while (workspace?.initializing && Date.now() < deadline) {
    await wait(WORKSPACE_READY_POLL_MS);
    workspace = await deps.workspaceSessionsService.getWorkspaceBySessionId(sessionId);
  }

  return workspace;
};

const fireSessionHook = (deps: SessionHookDeps, hookName: string, session: SessionRecord) => {
  void (async () => {
    let ctx: Record<string, unknown>;
    try {
      await waitForWorkspaceReady(deps, session.id);
      ctx = await resolveSessionHookContext(deps, session);
    } catch {
      ctx = { projectId: session.project_id, sessionId: session.id, sessionStatus: session.status };
    }

    const runtime = await deps.pluginService.getForProject(session.project_id);
    const hookClient = withHookSessionClient(runtime.client, ctx);
    await runtime.hooks.firePost(hookName as never, { ...ctx, client: hookClient } as never);
  })().catch(() => {});
};

export const fireSessionStatusHook = (deps: SessionHookDeps, session: SessionRecord) => {
  const hookName = STATUS_TO_HOOK[session.status as SessionStatus];
  if (hookName) {
    fireSessionHook(deps, hookName, session);
  }
};

export const fireSessionStartHook = (deps: SessionHookDeps, session: SessionRecord) => {
  fireSessionHook(deps, "postSessionStart", session);
};

export const fireSessionResumeHook = (deps: SessionHookDeps, session: SessionRecord) => {
  fireSessionHook(deps, "postSessionResume", session);
};
