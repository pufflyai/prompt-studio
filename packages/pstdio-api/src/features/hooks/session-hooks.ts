import type { EventRef, SessionLifecyclePayload } from "@pstdio/sdk/extensions";
import type { createAttemptStatusService } from "../../services/attempt-status-service";
import type { createRepoService } from "../../services/repo-service";
import type { createWorkspaceSessionService } from "../../services/workspace-session-service";
import {
  type ExtensionEventDeps,
  fireExtensionEvent,
  runExtensionCommand,
} from "../extensions/extension-event-runtime";
import { parseTicketShorthand } from "../workspaces/parse-ticket-shorthand";

// The pstdio-planner stored ticket/status shapes we read over the extension
// runtime. Kept local so session-hooks stays decoupled from the extension package.
type StoredTicketLike = {
  id: string;
  shorthand: string;
  title?: string;
  statusId?: string | null;
  parentId?: string | null;
};
type StoredStatusLike = { id: string; name: string };

type SessionStatus =
  | "in_progress"
  | "awaiting_input"
  | "queued"
  | "completed"
  | "failed"
  | "cancelled"
  | "disconnected";

type SessionRecord = {
  id: string;
  project_id: string;
  status: string;
  original_session_id?: string | null;
};

export type SessionHookDeps = {
  activityEventsService: unknown;
  extensionService: unknown;
  extensionSettingsService: unknown;
  extensionStorageService: unknown;
  fileService: unknown;
  repoService: ReturnType<typeof createRepoService>;
  sessionQueueEntriesService: unknown;
  sessionService: unknown;
  settingsService: unknown;
  templateService: unknown;
  workspaceService: unknown;
  workspaceSessionService: ReturnType<typeof createWorkspaceSessionService>;
  attemptStatusService?: ReturnType<typeof createAttemptStatusService>;
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

// Ticket and status now live in the pstdio-planner extension, so the session
// lifecycle payload resolves them through the in-process extension runtime rather
// than the legacy ticket/status services. The runner is injectable for testing.
export type RunExtensionCommand = typeof runExtensionCommand;

const resolveStoredTicket = async (
  runCommand: RunExtensionCommand,
  deps: SessionHookDeps,
  projectId: string,
  shorthand: string,
) => {
  const outcome = await runCommand<{ id: string }, StoredTicketLike | null>(
    deps as unknown as ExtensionEventDeps,
    projectId,
    "pstdio-planner.get-ticket",
    { id: shorthand },
  );
  return outcome.ok ? (outcome.value ?? null) : null;
};

const resolveTicketStatusName = async (
  runCommand: RunExtensionCommand,
  deps: SessionHookDeps,
  projectId: string,
  statusId: string | null,
) => {
  if (!statusId) return null;
  const outcome = await runCommand<Record<string, never>, StoredStatusLike[]>(
    deps as unknown as ExtensionEventDeps,
    projectId,
    "pstdio-planner.ticketStatus.read",
    {},
  );
  if (!outcome.ok) return null;
  return outcome.value.find((status) => status.id === statusId)?.name ?? null;
};

export const resolveSessionLifecyclePayload = async (
  deps: SessionHookDeps,
  session: SessionRecord,
  runCommand: RunExtensionCommand = runExtensionCommand,
) => {
  const base = {
    projectId: session.project_id,
    sessionId: session.id,
    sessionStatus: session.status as SessionStatus,
    ...(session.original_session_id && { originalSessionId: session.original_session_id }),
  };

  const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(session.id);
  if (!workspace) return base;

  const ticketShorthand =
    parseTicketShorthand(workspace.workspace_shorthand) ??
    (workspace as { ticket_shorthand?: string }).ticket_shorthand;

  let ticket: StoredTicketLike | null = null;
  if (ticketShorthand) {
    try {
      ticket = await resolveStoredTicket(runCommand, deps, session.project_id, ticketShorthand);
    } catch {
      // best-effort: a missing/unavailable extension must not break session start.
    }
  }

  let ticketStatusName: string | null = null;
  if (ticket?.statusId) {
    try {
      ticketStatusName = await resolveTicketStatusName(runCommand, deps, session.project_id, ticket.statusId);
    } catch {
      // best-effort
    }
  }

  let attemptStatus: string | undefined;
  if (deps.attemptStatusService && workspace.attempt_status_id) {
    try {
      attemptStatus = await resolveAttemptStatusName(
        { attemptStatusesService: deps.attemptStatusService },
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
    ticket: ticket ? { ...ticket, status_name: ticketStatusName } : undefined,
    ...(attemptStatus !== undefined && { attemptStatus }),
  };
};

const WORKSPACE_READY_TIMEOUT_MS = 5_000;
const WORKSPACE_READY_POLL_MS = 25;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForWorkspaceReady = async (deps: SessionHookDeps, sessionId: string) => {
  let workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(sessionId);
  const deadline = Date.now() + WORKSPACE_READY_TIMEOUT_MS;

  while (workspace?.initializing && Date.now() < deadline) {
    await wait(WORKSPACE_READY_POLL_MS);
    workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(sessionId);
  }

  return workspace;
};

export const fireSessionLifecycleEventAsync = (
  deps: SessionHookDeps,
  event: EventRef<SessionLifecyclePayload>,
  session: SessionRecord,
) => {
  void (async () => {
    let payload: SessionLifecyclePayload;
    try {
      await waitForWorkspaceReady(deps, session.id);
      payload = (await resolveSessionLifecyclePayload(deps, session)) as SessionLifecyclePayload;
    } catch {
      payload = { projectId: session.project_id, sessionId: session.id, sessionStatus: session.status };
    }

    await fireExtensionEvent(deps as unknown as ExtensionEventDeps, session.project_id, event, payload);
  })().catch(() => {});
};
