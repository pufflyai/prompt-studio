import type { EventRef, ResourceAnchor, SessionLifecyclePayload } from "@pstdio/sdk/extensions";
import type { createRepoService } from "../../services/repo-service";
import type { createWorkspaceSessionService } from "../../services/workspace-session-service";
import { type ExtensionEventDeps, fireExtensionEvent } from "../extensions/extension-event-runtime";

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
};

// The session lifecycle payload carries only generic fields. A domain extension
// (e.g. pstdio-planner) derives its ticket from the workspace's resource anchors;
// the host stays decoupled from any specific extension.
export const resolveSessionLifecyclePayload = async (deps: SessionHookDeps, session: SessionRecord) => {
  const base = {
    projectId: session.project_id,
    sessionId: session.id,
    sessionStatus: session.status as SessionStatus,
    ...(session.original_session_id && { originalSessionId: session.original_session_id }),
  };

  const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(session.id);
  if (!workspace) return base;

  return {
    ...base,
    workspace,
    workspaceId: workspace.id,
    worktreePath: workspace.worktree_path ?? undefined,
    branch: workspace.branch ?? undefined,
    anchors: (workspace.anchors_json ?? []) as ResourceAnchor[],
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
