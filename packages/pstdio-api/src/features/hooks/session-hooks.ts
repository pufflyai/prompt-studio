import type { EventRef, ResourceAnchor, SessionLifecyclePayload } from "pstdio-api-contracts/extension-kernel";
import { apiLogger } from "../../lib/logger";
import type { RouteDeps } from "../deps";
import { fireExtensionEvent } from "../extensions/extension-event-runtime";
import { waitForWorkspaceReady } from "../workspaces/wait-for-ready";

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
  anchors_json?: ResourceAnchor[] | null;
};

export type SessionHookDeps = Pick<
  RouteDeps,
  | "activityEventsService"
  | "eventBus"
  | "extensionAutomationPreferencesService"
  | "extensionFileService"
  | "extensionInstancesService"
  | "extensionService"
  | "extensionSettingsDBService"
  | "extensionSettingsService"
  | "extensionStorageService"
  | "fileService"
  | "harnessRegistry"
  | "notificationService"
  | "projectService"
  | "repoService"
  | "sessionQueueEntriesService"
  | "sessionService"
  | "skillService"
  | "settingsService"
  | "templateService"
  | "workspaceService"
  | "workspaceSessionService"
>;

// The session lifecycle payload carries only generic fields. A domain extension
// (e.g. pstdio-planner) derives its ticket from the workspace's resource anchors;
// the host stays decoupled from any specific extension.
export const resolveSessionLifecyclePayload = async (deps: SessionHookDeps, session: SessionRecord) => {
  const sessionAnchors = session.anchors_json ?? [];
  const base = {
    projectId: session.project_id,
    sessionId: session.id,
    sessionStatus: session.status as SessionStatus,
    ...(session.original_session_id && { originalSessionId: session.original_session_id }),
    ...(sessionAnchors.length > 0 && { anchors: sessionAnchors }),
  };

  const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(session.id);
  if (!workspace) return base;

  return {
    ...base,
    workspace,
    workspaceId: workspace.id,
    worktreePath: workspace.worktree_path ?? undefined,
    branch: workspace.branch ?? undefined,
    anchors: [...sessionAnchors, ...((workspace.anchors_json ?? []) as ResourceAnchor[])],
  };
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

    await fireExtensionEvent(deps, session.project_id, event, payload);
  })().catch((err) => {
    apiLogger.warn(
      { err, event: "extension.event.dispatch_failed", event_id: event.id, project_id: session.project_id },
      "Extension event dispatch failed",
    );
  });
};
